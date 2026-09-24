const Farmer = require('../models/Farmer');
const Buyer = require('../models/Buyer');
const { generateToken } = require('../../shared/middleware/auth');
const { AppError, asyncHandler } = require('../../shared/middleware/errorHandler');
const { sendOTPEmail } = require('../services/mailer');
const Joi = require('joi');
const crypto = require('crypto');

// Helper to generate a 6-digit numeric OTP string
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper to hash OTP using SHA-256 for secure storage at rest
const hashOTP = (otp) => {
    return crypto.createHash('sha256').update(String(otp)).digest('hex');
};

// Validation Schemas
const registerSchema = Joi.object({
    name: Joi.string().required().min(2).max(50),
    email: Joi.string().email().required().lowercase(),
    password: Joi.string().required().min(8),
    phno: Joi.alternatives().try(
        Joi.string().trim().pattern(/^[0-9]{10}$/),
        Joi.number().integer().custom((val, helpers) => {
            const str = String(val);
            if (!/^[0-9]{10}$/.test(str)) {
                return helpers.error('alternatives.match');
            }
            return str;
        })
    ).required().messages({
        'alternatives.match': 'Phone number must be a 10-digit number'
    }),
    role: Joi.string().valid('farmer', 'buyer').required(),
    state: Joi.string().required(),
    city: Joi.string().required(),
    pin: Joi.number().required(),
    location: Joi.object({
        type: Joi.string().valid('Point').default('Point'),
        coordinates: Joi.array().items(Joi.number()).length(2).default([0, 0]),
        address: Joi.string().allow('').default('')
    }).optional()
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const verifyOtpSchema = Joi.object({
    email: Joi.string().email().required().lowercase(),
    otp: Joi.string().length(6).pattern(/^[0-9]+$/).required().messages({
        'string.length': 'OTP must be exactly 6 digits',
        'string.pattern.base': 'OTP must contain numbers only'
    })
});

const resendOtpSchema = Joi.object({
    email: Joi.string().email().required().lowercase()
});

/**
 * Register new user & send Email Verification OTP
 * POST /api/v1/auth/register
 */
exports.register = asyncHandler(async (req, res, next) => {
    // 1. Validate Input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }

    let { name, email, password, phno, role, state, city, pin, location } = value;
    phno = String(phno).trim();

    const locationData = location || { type: 'Point', coordinates: [0, 0], address: '' };

    // 2. Check if user already exists
    const existingFarmer = await Farmer.findOne({ email });
    const existingBuyer = await Buyer.findOne({ email });
    if (existingFarmer || existingBuyer) {
        return next(new AppError('Email is already registered. Please login.', 400));
    }

    // 3. Generate 6-digit OTP and set expiration (10 minutes)
    const rawOtp = generateOTP();
    const hashedOtp = hashOTP(rawOtp);
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // 4. Create user with isEmailVerified: false
    let user;
    const userData = {
        name,
        email,
        password,
        phno,
        state,
        city,
        pin,
        location: locationData,
        isEmailVerified: false,
        otpCode: hashedOtp,
        otpExpiresAt,
        otpAttempts: 0,
        otpLastSentAt: new Date()
    };

    try {
        if (role === 'farmer') {
            user = await Farmer.create(userData);
        } else {
            user = await Buyer.create(userData);
        }
    } catch (err) {
        if (err.code === 11000) {
            return next(new AppError('Email is already registered.', 400));
        }
        throw err;
    }

    // 5. Send OTP via Nodemailer with error fallback cleanup
    try {
        await sendOTPEmail(user.email, rawOtp, user.name);
    } catch (emailError) {
        console.error('Failed to send verification OTP email:', emailError);
        // Rollback user creation to prevent half-created unverified accounts
        if (user && user._id) {
            if (role === 'farmer') {
                await Farmer.findByIdAndDelete(user._id);
            } else {
                await Buyer.findByIdAndDelete(user._id);
            }
        }
        return next(new AppError('Failed to send verification email. Please check your email address and try registering again.', 500));
    }

    // 6. Return success response without JWT (user is not verified yet)
    res.status(201).json({
        success: true,
        message: 'Registration successful! A 6-digit verification code has been sent to your email.',
        data: {
            email: user.email,
            role,
            requiresVerification: true
        }
    });
});

/**
 * Verify OTP & Activate User Account
 * POST /api/v1/auth/verify-otp
 */
exports.verifyOtp = asyncHandler(async (req, res, next) => {
    // 1. Validate Input
    const { error, value } = verifyOtpSchema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }

    const { email, otp } = value;

    // 2. Lookup User across Farmer & Buyer models
    let user = await Farmer.findOne({ email }).select('+otpCode +otpExpiresAt +otpAttempts +isEmailVerified');
    let role = 'farmer';

    if (!user) {
        user = await Buyer.findOne({ email }).select('+otpCode +otpExpiresAt +otpAttempts +isEmailVerified');
        role = 'buyer';
    }

    if (!user) {
        return next(new AppError('User not found with this email address.', 404));
    }

    // 3. Check if already verified
    if (user.isEmailVerified) {
        const token = generateToken(user._id, role);
        return res.status(200).json({
            success: true,
            message: 'Email address is already verified.',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role,
                isEmailVerified: true
            }
        });
    }

    // 4. Rate-limit check: Max 5 failed attempts per OTP lifecycle
    if (user.otpAttempts >= 5) {
        return next(new AppError('Maximum verification attempts (5) exceeded. Please request a new OTP.', 429));
    }

    // 5. Expiration Check
    if (!user.otpExpiresAt || Date.now() > new Date(user.otpExpiresAt).getTime()) {
        return next(new AppError('OTP has expired. Please request a new OTP.', 400));
    }

    // 6. Validate OTP Hash
    const hashedInputOtp = hashOTP(otp);
    if (hashedInputOtp !== user.otpCode) {
        user.otpAttempts += 1;
        await user.save();
        const remaining = 5 - user.otpAttempts;
        return next(new AppError(`Invalid OTP code. Remaining attempts: ${remaining}`, 400));
    }

    // 7. Verification Success: Activate Account & Clear OTP Data
    user.isEmailVerified = true;
    user.otpCode = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.otpLastSentAt = undefined;
    await user.save();

    // 8. Generate Session JWT Token
    const token = generateToken(user._id, role);

    res.status(200).json({
        success: true,
        message: 'Email verified successfully! Your account is now active.',
        token,
        user: {
            id: user._id,
            profileId: user._id,
            name: user.name,
            email: user.email,
            role,
            phno: user.phno,
            state: user.state,
            city: user.city,
            pin: user.pin,
            isEmailVerified: true
        }
    });
});

/**
 * Resend Email Verification OTP
 * POST /api/v1/auth/resend-otp
 */
exports.resendOtp = asyncHandler(async (req, res, next) => {
    // 1. Validate Input
    const { error, value } = resendOtpSchema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }

    const { email } = value;

    // 2. Lookup User
    let user = await Farmer.findOne({ email }).select('+otpCode +otpExpiresAt +otpAttempts +otpLastSentAt +isEmailVerified');
    let role = 'farmer';

    if (!user) {
        user = await Buyer.findOne({ email }).select('+otpCode +otpExpiresAt +otpAttempts +otpLastSentAt +isEmailVerified');
        role = 'buyer';
    }

    if (!user) {
        return next(new AppError('User not found with this email address.', 404));
    }

    // 3. Check if already verified
    if (user.isEmailVerified) {
        return next(new AppError('Your email address is already verified. Please log in.', 400));
    }

    // 4. Cooldown Check (60 seconds between resends)
    const COOLDOWN_MS = 60 * 1000;
    if (user.otpLastSentAt && (Date.now() - new Date(user.otpLastSentAt).getTime()) < COOLDOWN_MS) {
        const secondsRemaining = Math.ceil((COOLDOWN_MS - (Date.now() - new Date(user.otpLastSentAt).getTime())) / 1000);
        return next(new AppError(`Please wait ${secondsRemaining} seconds before requesting a new OTP.`, 429));
    }

    // 5. Generate New OTP & Reset Expiry (10 mins) and Attempts (0)
    const rawOtp = generateOTP();
    user.otpCode = hashOTP(rawOtp);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    user.otpAttempts = 0;
    user.otpLastSentAt = new Date();
    await user.save();

    // 6. Send OTP Email
    try {
        await sendOTPEmail(user.email, rawOtp, user.name);
    } catch (emailError) {
        console.error('Failed to resend verification OTP email:', emailError);
        return next(new AppError('Failed to send verification email. Please try again later.', 500));
    }

    res.status(200).json({
        success: true,
        message: 'A new 6-digit verification code has been sent to your email address.'
    });
});

/**
 * Login User
 * POST /api/v1/auth/login
 */
exports.login = asyncHandler(async (req, res, next) => {
    // 1. Validate Input
    const { error } = loginSchema.validate(req.body);
    if (error) {
        return next(new AppError(error.details[0].message, 400));
    }

    const { email, password } = req.body;

    // 2. Try Farmer first
    let user = await Farmer.findOne({ email }).select('+password +isEmailVerified');
    let role = 'farmer';

    // 3. If not Farmer, try Buyer
    if (!user) {
        user = await Buyer.findOne({ email }).select('+password +isEmailVerified');
        role = 'buyer';
    }

    // 4. Validate Credentials
    if (!user || !user.password || !(await user.comparePassword(password))) {
        return next(new AppError('Invalid credentials', 401));
    }

    // 5. Check if Email is Verified
    if (!user.isEmailVerified) {
        return res.status(403).json({
            success: false,
            message: 'Your email address is not verified. Please verify your email before logging in.',
            requiresVerification: true,
            email: user.email
        });
    }

    // 6. Generate JWT Token
    const token = generateToken(user._id, role);

    res.json({
        success: true,
        token,
        user: {
            id: user._id,
            profileId: user._id,
            name: user.name,
            email: user.email,
            role,
            phno: user.phno,
            state: user.state,
            city: user.city,
            pin: user.pin,
            isEmailVerified: true,
            location: user.location
        }
    });
});

/**
 * Get Current User Profile
 * GET /api/v1/auth/me
 */
exports.getMe = asyncHandler(async (req, res, next) => {
    const userId = req.userId;
    const role = req.userRole;

    let user;
    if (role === 'farmer') {
        user = await Farmer.findById(userId);
    } else {
        user = await Buyer.findById(userId);
    }

    if (!user) {
        return next(new AppError('User not found', 404));
    }

    res.json({
        success: true,
        user: {
            id: user._id,
            profileId: user._id,
            name: user.name,
            email: user.email,
            role,
            phno: user.phno,
            state: user.state,
            city: user.city,
            pin: user.pin,
            isEmailVerified: user.isEmailVerified,
            location: user.location
        }
    });
});

/**
 * Logout User
 * POST /api/v1/auth/logout
 */
exports.logout = asyncHandler(async (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Verify JWT Token (Internal Inter-service call)
 * GET /api/v1/auth/verify
 */
exports.verifyToken = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        userId: req.userId,
        role: req.userRole
    });
});
