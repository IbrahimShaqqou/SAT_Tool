/**
 * useApi hook
 * Handles API calls with loading and error states
 */
import { useState, useCallback } from 'react';
import api from '../services/api';

export const useApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (method, url, data = null, config = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api({
        method,
        url,
        data,
        ...config,
      });
      return { data: response.data, error: null };
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Request failed';
      setError(message);
      return { data: null, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const get = useCallback((url, config) => request('get', url, null, config), [request]);
  const post = useCallback((url, data, config) => request('post', url, data, config), [request]);
  const put = useCallback((url, data, config) => request('put', url, data, config), [request]);
  const patch = useCallback((url, data, config) => request('patch', url, data, config), [request]);
  const del = useCallback((url, config) => request('delete', url, null, config), [request]);

  const clearError = useCallback(() => setError(null), []);

  return {
    isLoading,
    error,
    clearError,
    get,
    post,
    put,
    patch,
    delete: del,
    request,
  };
};
