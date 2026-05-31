/**
 * Reset Password Page
 * Allows users to set a new password using a reset token
 */
import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Button, Input } from '../../components/ui';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    setApiError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    if (!validate()) return;

    if (!token) {
      setApiError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: formData.password,
      });
      setSuccess(true);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setApiError(detail);
      } else if (err.response?.status === 429) {
        setApiError('Too many attempts. Please wait a moment and try again.');
      } else {
        setApiError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // No token provided
  if (!token) {
    return (
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-rose-100 dark:bg-rose-900/30 mb-4">
          <svg className="h-6 w-6 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink-body mb-2">
          Invalid reset link
        </h1>
        <p className="text-sm text-ink-muted mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          to="/forgot-password"
          className="text-sm font-medium text-ink-body hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-accent-100 dark:bg-accent-900/30 mb-4">
          <svg className="h-6 w-6 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink-body mb-2">
          Password reset successful
        </h1>
        <p className="text-sm text-ink-muted mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Button
          variant="primary"
          onClick={() => navigate('/login')}
        >
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-body text-center mb-2">
        Create new password
      </h1>
      <p className="text-sm text-ink-muted text-center mb-6">
        Enter a new password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {apiError && (
          <div role="alert" className="p-3 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800/50">
            {apiError}
          </div>
        )}

        <Input
          label="New password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm password"
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          placeholder="Confirm your password"
          autoComplete="new-password"
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          Reset password
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-subtle">
        <Link to="/login" className="font-medium text-ink-body hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
};

export default ResetPasswordPage;
