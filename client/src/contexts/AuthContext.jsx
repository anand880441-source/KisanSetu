import { createContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '../services/auth.service';
import { setToken, setUser, getToken, getUser, clearAuth } from '../services/storage.service';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUserState] = useState(null);
    const [token, setTokenState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const storedUser = getUser();
        const storedToken = getToken();
        if (storedToken && storedUser) {
            setUserState(storedUser);
            setTokenState(storedToken);
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email, password) => {
        try {
            setError(null);
            const response = await authService.login(email, password);
            const { token: authToken, user: userData } = response.data;
            setToken(authToken);
            setUser(userData);
            setUserState(userData);
            setTokenState(authToken);
            navigate(userData.role === 'farmer' ? '/farmer/dashboard' : '/buyer/browse');
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            setError(message);
            return { success: false, error: message };
        }
    }, [navigate]);

    const signup = useCallback(async (formData) => {
        try {
            setError(null);
            const response = await authService.register(formData);
            const resData = response.data;
            
            // Check if backend returned OTP email verification requirement
            if (resData?.data?.requiresVerification) {
                return { success: true, requiresVerification: true, email: resData.data.email };
            }

            // Standard fallback if token & user are returned directly
            const { token: authToken, user: userData } = resData;
            if (authToken && userData) {
                setToken(authToken);
                setUser(userData);
                setUserState(userData);
                setTokenState(authToken);
                navigate(userData.role === 'farmer' ? '/farmer/dashboard' : '/buyer/browse');
            }
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Signup failed';
            setError(message);
            return { success: false, error: message };
        }
    }, [navigate]);

    const verifyOtp = useCallback(async (email, otp) => {
        try {
            setError(null);
            const response = await authService.verifyOtp(email, otp);
            const { token: authToken, user: userData } = response.data;
            setToken(authToken);
            setUser(userData);
            setUserState(userData);
            setTokenState(authToken);
            navigate(userData.role === 'farmer' ? '/farmer/dashboard' : '/buyer/browse');
            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'OTP verification failed';
            setError(message);
            return { success: false, error: message };
        }
    }, [navigate]);

    const resendOtp = useCallback(async (email) => {
        try {
            setError(null);
            const response = await authService.resendOtp(email);
            return { success: true, message: response.data?.message || 'OTP resent successfully' };
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to resend OTP';
            setError(message);
            return { success: false, error: message };
        }
    }, []);

    const logout = useCallback(() => {
        setUserState(null);
        setTokenState(null);
        clearAuth();
        navigate('/auth/login');
    }, [navigate]);

    const isAuthenticated = !!user;

    return (
        <AuthContext.Provider value={{ user, token, loading, error, isAuthenticated, login, signup, verifyOtp, resendOtp, logout, setError }}>
            {children}
        </AuthContext.Provider>
    );
};
