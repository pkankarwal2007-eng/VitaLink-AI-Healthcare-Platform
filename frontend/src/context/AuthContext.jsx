import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('vitalink_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('vitalink_token'));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Restore authenticated session on initial mount
  // Restore authenticated session on initial mount
  const restoreSession = useCallback(async () => {
    const savedToken = localStorage.getItem('vitalink_token');
    if (!savedToken) {
      delete apiClient.defaults.headers.common['Authorization'];
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      const response = await apiClient.get('/auth/me');
      if (response.data && response.data.success) {
        const fetchedUser = response.data.data.user;
        setUser(fetchedUser);
        setToken(savedToken);
        localStorage.setItem('vitalink_user', JSON.stringify(fetchedUser));
      } else {
        throw new Error('Session invalid');
      }
    } catch (err) {
      console.warn('[VitaLink Auth] Session restoration failed:', err.response?.data?.message || err.message);
      localStorage.removeItem('vitalink_token');
      localStorage.removeItem('vitalink_user');
      delete apiClient.defaults.headers.common['Authorization'];
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Synchronize authentication state across browser tabs and windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'vitalink_token' || e.key === 'vitalink_user') {
        const currentToken = localStorage.getItem('vitalink_token');
        const currentUserStr = localStorage.getItem('vitalink_user');
        setToken(currentToken);
        try {
          setUser(currentUserStr ? JSON.parse(currentUserStr) : null);
        } catch {
          setUser(null);
        }
        if (currentToken) {
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
          restoreSession();
        } else {
          delete apiClient.defaults.headers.common['Authorization'];
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [restoreSession]);

  // Standard User Login (Patient, Doctor, Shipping)
  const login = async (email, password) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { user: userData, token: userToken } = response.data.data;

      localStorage.setItem('vitalink_token', userToken);
      localStorage.setItem('vitalink_user', JSON.stringify(userData));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      setToken(userToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      let msg;
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
        msg = err.response.data.trim();
      } else if (err.response?.status === 429) {
        msg = 'Too many requests from this IP. Please wait a moment and try again.';
      } else if (err.message === 'Network Error' || !err.response) {
        msg = 'Unable to connect to the VitaLink server. Please ensure the backend server is running on port 5000.';
      } else {
        msg = 'Login failed. Please check your credentials.';
      }
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        const errorMsg = err.response.data.message || 'Your email is not verified. Please verify your email before logging in.';
        setError(errorMsg);
        return {
          success: false,
          code: 'EMAIL_NOT_VERIFIED',
          email: err.response.data.data?.email || email,
          message: errorMsg
        };
      }

      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Dedicated Administrative Login (verifies role === 'admin')
  const adminLogin = async (email, password) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/admin-login', { email, password });
      const { user: userData, token: userToken } = response.data.data;

      localStorage.setItem('vitalink_token', userToken);
      localStorage.setItem('vitalink_user', JSON.stringify(userData));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      setToken(userToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      let msg;
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (typeof err.response?.data === 'string' && err.response.data.trim()) {
        msg = err.response.data.trim();
      } else if (err.response?.status === 429) {
        msg = 'Too many requests from this IP. Please wait a moment and try again.';
      } else if (err.message === 'Network Error' || !err.response) {
        msg = 'Unable to connect to the VitaLink server. Please ensure the backend server is running on port 5000.';
      } else {
        msg = 'Admin authentication failed.';
      }
      setError(msg);
      return { success: false, message: msg };
    }
  };

  // Register new account (Patient, Doctor, Shipping Partner)
  const register = async (formData) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/register', formData);
      const { user: userData, token: userToken, isEmailVerified } = response.data.data;

      // If email verification is pending, do not establish active session yet
      if (isEmailVerified === false) {
        return {
          success: true,
          isEmailVerified: false,
          user: userData,
          email: userData?.email || formData.email,
          message: response.data.message
        };
      }

      localStorage.setItem('vitalink_token', userToken);
      localStorage.setItem('vitalink_user', JSON.stringify(userData));
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
      setToken(userToken);
      setUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.';
      const errors = err.response?.data?.errors || [];
      setError(msg);
      return { success: false, message: msg, errors };
    }
  };

  // Verify Email Address with 6-digit OTP
  const verifyEmail = async (email, otp) => {
    setError(null);
    try {
      const response = await apiClient.post('/auth/verify-email', { email, otp });
      const { user: userData, token: userToken } = response.data.data || {};
      if (userToken && userData) {
        localStorage.setItem('vitalink_token', userToken);
        localStorage.setItem('vitalink_user', JSON.stringify(userData));
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${userToken}`;
        setToken(userToken);
        setUser(userData);
      }
      return {
        success: true,
        message: response.data.message,
        data: response.data.data
      };
    } catch (err) {
      let msg = err.response?.data?.message;
      if (!msg) {
        if (typeof err.response?.data === 'string' && err.response.data.trim()) {
          msg = err.response.data.trim();
        } else if (err.response?.status === 429) {
          msg = 'Too many verification attempts. Please wait before trying again.';
        } else {
          msg = 'Email verification failed. Please check the code and try again.';
        }
      }
      setError(msg);
      return {
        success: false,
        message: msg,
        code: err.response?.data?.code,
        attemptsRemaining: err.response?.data?.attemptsRemaining
      };
    }
  };

  // Resend Verification Code with rate limit handling
  const resendVerification = async (email) => {
    try {
      const response = await apiClient.post('/auth/resend-verification', { email });
      return {
        success: true,
        message: response.data.message,
        cooldownSeconds: response.data.data?.cooldownSeconds || 60
      };
    } catch (err) {
      let msg = err.response?.data?.message;
      if (!msg) {
        if (typeof err.response?.data === 'string' && err.response.data.trim()) {
          msg = err.response.data.trim();
        } else if (err.response?.status === 429) {
          msg = 'Resend request throttled. Please wait before requesting another code.';
        } else {
          msg = 'Failed to resend verification code. Please try again.';
        }
      }
      return {
        success: false,
        message: msg,
        code: err.response?.data?.code,
        secondsRemaining: err.response?.data?.secondsRemaining
      };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('vitalink_token');
    localStorage.removeItem('vitalink_user');
    delete apiClient.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setError(null);
  };

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!user && !!token,
    login,
    adminLogin,
    register,
    verifyEmail,
    resendVerification,
    logout,
    restoreSession
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
