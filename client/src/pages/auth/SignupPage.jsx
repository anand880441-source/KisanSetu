import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import LocationPicker from '../../components/shared/LocationPicker';
import './Auth.css';

const SignupPage = () => {
    const { signup, verifyOtp, resendOtp, error, setError } = useAuth();
    
    // Step state: 'signup' or 'verify'
    const [step, setStep] = useState('signup');
    const [registeredEmail, setRegisteredEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const [infoMessage, setInfoMessage] = useState('');

    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        phno: '', role: 'buyer', state: '', city: '', pin: '',
        location: { coordinates: [], address: '' }
    });
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    // Countdown timer for Resend OTP button
    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setInterval(() => {
                setResendCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [resendCooldown]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.name) newErrors.name = 'Name is required';
        if (!formData.email) newErrors.email = 'Email is required';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Invalid email';
        if (!formData.password) newErrors.password = 'Password is required';
        else if (formData.password.length < 8) newErrors.password = 'Min 8 characters';
        if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
        if (!formData.phno) newErrors.phno = 'Phone is required';
        else if (!/^[0-9]{10}$/.test(formData.phno.trim())) newErrors.phno = 'Must be a 10-digit phone number';
        if (!formData.state) newErrors.state = 'State is required';
        if (!formData.city) newErrors.city = 'City is required';
        if (!formData.pin) newErrors.pin = 'PIN is required';
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }
        setLoading(true);
        const { confirmPassword, ...signupData } = formData;
        signupData.phno = String(signupData.phno).trim();
        signupData.pin = Number(signupData.pin);
        
        if (!signupData.location?.coordinates?.length) {
            delete signupData.location;
        }

        const result = await signup(signupData);
        setLoading(false);

        if (result?.requiresVerification) {
            setRegisteredEmail(result.email || formData.email);
            setStep('verify');
            setResendCooldown(60);
            setInfoMessage(`A 6-digit verification code was sent to ${result.email || formData.email}`);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otpCode || otpCode.length !== 6) {
            setErrors({ otp: 'Please enter a valid 6-digit OTP' });
            return;
        }
        setLoading(true);
        setErrors({});
        const res = await verifyOtp(registeredEmail, otpCode);
        setLoading(false);
        if (!res?.success && res?.error) {
            setErrors({ otp: res.error });
        }
    };

    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        setLoading(true);
        setError(null);
        setInfoMessage('');
        const res = await resendOtp(registeredEmail);
        setLoading(false);
        if (res?.success) {
            setInfoMessage(res.message || 'A new OTP has been sent to your email.');
            setResendCooldown(60);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-container auth-container-wide">
                {step === 'signup' ? (
                    <>
                        <div className="auth-header">
                            <h1 className="auth-title">Create your account</h1>
                            <p className="auth-subtitle">Join KisanSetu — choose farmer or buyer to get started</p>
                        </div>

                        <form onSubmit={handleSubmit} className="auth-form">
                            {error && <div className="alert alert-error">{error}</div>}

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="name">Full Name</label>
                                    <input type="text" id="name" name="name" value={formData.name}
                                        onChange={handleChange} className={`form-input ${errors.name ? 'error' : ''}`}
                                        placeholder="John Doe" disabled={loading} autoComplete="name" />
                                    {errors.name && <span className="error-text">{errors.name}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="email">Email</label>
                                    <input type="email" id="email" name="email" value={formData.email}
                                        onChange={handleChange} className={`form-input ${errors.email ? 'error' : ''}`}
                                        placeholder="your@email.com" disabled={loading} autoComplete="email" />
                                    {errors.email && <span className="error-text">{errors.email}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="password">Password</label>
                                    <input type="password" id="password" name="password" value={formData.password}
                                        onChange={handleChange} className={`form-input ${errors.password ? 'error' : ''}`}
                                        placeholder="••••••••" disabled={loading} autoComplete="new-password" />
                                    {errors.password && <span className="error-text">{errors.password}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="confirmPassword">Confirm Password</label>
                                    <input type="password" id="confirmPassword" name="confirmPassword" value={formData.confirmPassword}
                                        onChange={handleChange} className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                                        placeholder="••••••••" disabled={loading} autoComplete="new-password" />
                                    {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label htmlFor="phno">Phone Number</label>
                                    <input type="tel" id="phno" name="phno" value={formData.phno}
                                        onChange={handleChange} className={`form-input ${errors.phno ? 'error' : ''}`}
                                        placeholder="9876543210" disabled={loading} autoComplete="tel" />
                                    {errors.phno && <span className="error-text">{errors.phno}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="role">I am a</label>
                                    <select id="role" name="role" value={formData.role}
                                        onChange={handleChange} className="form-input" disabled={loading}>
                                        <option value="buyer">Buyer</option>
                                        <option value="farmer">Farmer</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-row form-row-3">
                                <div className="form-group">
                                    <label htmlFor="state">State</label>
                                    <input type="text" id="state" name="state" value={formData.state}
                                        onChange={handleChange} className={`form-input ${errors.state ? 'error' : ''}`}
                                        placeholder="Karnataka" disabled={loading} />
                                    {errors.state && <span className="error-text">{errors.state}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="city">City</label>
                                    <input type="text" id="city" name="city" value={formData.city}
                                        onChange={handleChange} className={`form-input ${errors.city ? 'error' : ''}`}
                                        placeholder="Bangalore" disabled={loading} />
                                    {errors.city && <span className="error-text">{errors.city}</span>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="pin">PIN Code</label>
                                    <input type="text" id="pin" name="pin" value={formData.pin}
                                        onChange={handleChange} className={`form-input ${errors.pin ? 'error' : ''}`}
                                        placeholder="560001" disabled={loading} />
                                    {errors.pin && <span className="error-text">{errors.pin}</span>}
                                </div>
                            </div>

                            <div className="form-section location-section">
                                <label className="section-label">Location (optional)</label>
                                <p className="section-hint">Add your location now for faster deliveries — you can change it later</p>
                                <LocationPicker
                                    value={formData.location}
                                    onChange={(location) => setFormData(prev => ({ ...prev, location }))}
                                    disabled={loading}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                                {loading ? <span className="spinner spinner-small"></span> : 'Create Account'}
                            </button>
                        </form>

                        <p className="auth-footer">
                            Already have an account? <Link to="/auth/login">Sign in here</Link>
                        </p>
                    </>
                ) : (
                    <>
                        <div className="auth-header">
                            <h1 className="auth-title">Verify your Email</h1>
                            <p className="auth-subtitle">Enter the 6-digit code sent to <strong>{registeredEmail}</strong></p>
                        </div>

                        <form onSubmit={handleVerifyOtp} className="auth-form">
                            {infoMessage && <div className="alert alert-success">{infoMessage}</div>}
                            {error && <div className="alert alert-error">{error}</div>}

                            <div className="form-group">
                                <label htmlFor="otpCode">6-Digit Verification OTP</label>
                                <input
                                    type="text"
                                    id="otpCode"
                                    name="otpCode"
                                    maxLength={6}
                                    value={otpCode}
                                    onChange={(e) => {
                                        setOtpCode(e.target.value.replace(/[^0-9]/g, ''));
                                        setErrors({});
                                    }}
                                    className={`form-input ${errors.otp ? 'error' : ''}`}
                                    placeholder="123456"
                                    disabled={loading}
                                    autoFocus
                                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '6px', fontWeight: 'bold' }}
                                />
                                {errors.otp && <span className="error-text">{errors.otp}</span>}
                            </div>

                            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                                {loading ? <span className="spinner spinner-small"></span> : 'Verify Email & Complete Signup'}
                            </button>
                        </form>

                        <div className="auth-footer" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleResendOtp}
                                disabled={loading || resendCooldown > 0}
                            >
                                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP Email'}
                            </button>

                            <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary, #2e7d32)', cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => {
                                    setStep('signup');
                                    setError(null);
                                }}
                            >
                                ← Back to Signup Details
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SignupPage;
