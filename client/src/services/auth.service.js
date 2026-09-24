import api from './api';

export const login = (email, password) => api.post('/auth/login', { email, password });
export const register = (userData) => api.post('/auth/register', userData);
export const verifyOtp = (email, otp) => api.post('/auth/verify-otp', { email, otp });
export const resendOtp = (email) => api.post('/auth/resend-otp', { email });
export const getMe = () => api.get('/auth/me');
export const logout = () => api.post('/auth/logout');
