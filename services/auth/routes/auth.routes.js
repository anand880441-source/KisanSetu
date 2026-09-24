const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../../shared/middleware/auth');

// Rate limiter for OTP endpoints to prevent brute-force attacks (10 requests per 15 minutes per IP)
const otpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many OTP requests from this IP address. Please try again after 15 minutes.'
    }
});

// Rate limiter for registration & login (20 requests per 15 minutes per IP)
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many authentication attempts. Please try again later.'
    }
});

// Public authentication routes
router.post('/register', authRateLimiter, authController.register);
router.post('/login', authRateLimiter, authController.login);

// OTP Email Verification routes
router.post('/verify-otp', otpRateLimiter, authController.verifyOtp);
router.post('/resend-otp', otpRateLimiter, authController.resendOtp);

// Protected user routes
router.get('/me', verifyToken, authController.getMe);
router.post('/logout', verifyToken, authController.logout);
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router;
