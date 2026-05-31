/**
 * Login Page
 * Supports dark mode
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input } from '../../components/ui';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, error: authError } = useAuth();

  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const from = location.state?.from?.pathname || null;

  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    if (rememberedEmail) {
      setFormData(prev => ({ ...prev, email: rememberedEmail }));
      setRememberMe(true);
    }
  }, []);

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    const result = await login(formData.email, formData.password);
    setIsLoading(false);
    if (result.success) {
      if (rememberMe) localStorage.setItem('rememberedEmail', formData.email);
      else localStorage.removeItem('rememberedEmail');
      if (from) navigate(from, { replace: true });
      else navigate('/', { replace: true });
    }
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-body tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Sign in to continue your SAT prep
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {authError && (
          <div role="alert" className="p-3.5 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
            {authError}
          </div>
        )}

        <Input
          label="Email address"
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-edge text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500"
            />
            <span className="text-sm text-ink-muted">Remember me</span>
          </label>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 dark:text-brand-400 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2"
          loading={isLoading}
          disabled={isLoading}
        >
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
          Create one free
        </Link>
      </p>
    </>
  );
};

export default LoginPage;
