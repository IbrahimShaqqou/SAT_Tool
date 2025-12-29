/**
 * Authentication Context
 * Manages user authentication state and provides auth methods
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const AuthContext = createContext(null);

/**
 * Hook to access auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
        } catch (err) {
          // Token invalid, clear it
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Helper to extract error message from various API error formats
  const extractErrorMessage = (err, defaultMsg) => {
    const detail = err.response?.data?.detail;
    if (!detail) return defaultMsg;
    if (typeof detail === 'string') return detail;
    // FastAPI validation errors come as array of objects with msg field
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map(e => e.msg || e.message).join(', ');
    }
    // Object with msg field
    if (detail.msg) return detail.msg;
    return defaultMsg;
  };

  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      // Backend uses OAuth2PasswordRequestForm which expects form data with 'username' field
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token, refresh_token } = response.data;

      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('refreshToken', refresh_token);

      // Fetch user profile after login
      const userResponse = await api.get('/auth/me');
      setUser(userResponse.data);

      return { success: true };
    } catch (err) {
      const message = extractErrorMessage(err, 'Login failed');
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const register = useCallback(async (data) => {
    setError(null);
    try {
      // Register the user
      await api.post('/auth/register', data);

      // Auto-login after registration
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const loginResponse = await api.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      const { access_token, refresh_token } = loginResponse.data;

      localStorage.setItem('accessToken', access_token);
      localStorage.setItem('refreshToken', refresh_token);

      // Fetch user profile
      const userResponse = await api.get('/auth/me');
      setUser(userResponse.data);

      return { success: true };
    } catch (err) {
      const message = extractErrorMessage(err, 'Registration failed');
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
