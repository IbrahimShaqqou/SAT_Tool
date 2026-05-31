/**
 * Register Page
 * Supports dark mode
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Button, Input, Select } from '../../components/ui';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    last_name: '',
    role: 'student',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const roleOptions = [
    { value: 'student', label: 'Student' },
    { value: 'tutor', label: 'Tutor' },
  ];

  const validate = () => {
    const newErrors = {};
    if (!formData.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!formData.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 8) newErrors.password = 'At least 8 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.role) newErrors.role = 'Please select a role';
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
    const { confirmPassword, ...registerData } = formData;
    const result = await register(registerData);
    setIsLoading(false);
    if (result.success) navigate('/', { replace: true });
  };

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-ink-body tracking-tight">
          Create your account
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Free to start. No credit card required.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {authError && (
          <div role="alert" className="p-3.5 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
            {authError}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            error={errors.first_name}
            placeholder="John"
            required
          />
          <Input
            label="Last name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            error={errors.last_name}
            placeholder="Doe"
            required
          />
        </div>

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

        <Select
          label="I am a..."
          name="role"
          value={formData.role}
          onChange={handleChange}
          error={errors.role}
          options={roleOptions}
          required
        />

        <Input
          label="Password"
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
          size="lg"
          className="w-full mt-2"
          loading={isLoading}
          disabled={isLoading}
        >
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 dark:text-brand-400 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
};

export default RegisterPage;
