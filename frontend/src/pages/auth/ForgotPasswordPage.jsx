/**
 * Forgot Password Page
 * Allows users to request a password reset email
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Button, Input } from '../../components/ui';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState(null);

  const validate = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await api.post('/auth/forgot-password', { email });
      setSuccess(true);
      // In development mode, the API returns the reset URL directly
      if (response.data.reset_url) {
        setResetUrl(response.data.reset_url);
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (err.response?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div>
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-accent-100 dark:bg-accent-900/30 mb-4">
            <svg className="h-6 w-6 text-accent-600 dark:text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-2xl font-semibold text-ink-body mb-2">
            Check your email
          </h1>
          <p className="text-sm text-ink-muted mb-6">
            If an account with that email exists, we've sent password reset instructions.
          </p>

          {/* Development mode: show reset link directly */}
          {resetUrl && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
              <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                Development mode - Reset link:
              </p>
              <a
                href={resetUrl}
                className="text-sm text-brand-700 dark:text-brand-400 hover:underline break-all"
              >
                {resetUrl}
              </a>
            </div>
          )}

          <Link
            to="/login"
            className="text-sm font-medium text-ink-body hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-body text-center mb-2">
        Reset your password
      </h1>
      <p className="text-sm text-ink-muted text-center mb-6">
        Enter your email address and we'll send you instructions to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800/50">
            {error}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full"
          loading={isLoading}
          disabled={isLoading}
        >
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-subtle">
        Remember your password?{' '}
        <Link to="/login" className="font-medium text-ink-body hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default ForgotPasswordPage;
