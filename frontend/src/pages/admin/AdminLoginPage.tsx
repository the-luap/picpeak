import React, { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useQuery } from '@tanstack/react-query';

import { Button, Input, Card, ReCaptcha } from '../../components/common';
import { useAdminAuth } from '../../contexts';
import { authService } from '../../services/auth.service';
import { getAuthToken, api } from '../../config/api';

export const AdminLoginPage: React.FC = () => {
  const { isAuthenticated, login } = useAdminAuth();
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  // Fetch branding settings
  const { data: settingsData } = useQuery({
    queryKey: ['admin-login-settings'],
    queryFn: async () => {
      const response = await api.get('/public/settings');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Check for session expired message
  useEffect(() => {
    if (searchParams.get('session') === 'expired') {
      toast.info('Your session has expired. Please log in again.');
    }
  }, [searchParams]);

  // Redirect if already authenticated or login successful
  if (isAuthenticated || loginSuccess) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await authService.adminLogin({
        ...formData,
        recaptchaToken
      });
      login(response.token, response.user);
      toast.success('Login successful!');
      setLoginSuccess(true);
    } catch (error: any) {
      // Login error handled by UI notification
      
      // Handle network errors gracefully
      if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_RESET') {
        // Check if we actually got logged in despite the error
        const token = getAuthToken(true);
        if (token) {
          // Login was successful, just had a connection issue
          setLoginSuccess(true);
          return;
        }
        toast.error('Network error. Please check your connection and try again.');
      } else if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please try again later.');
      } else if (error.response?.status === 401) {
        setErrors({ form: 'Invalid email or password' });
      } else {
        toast.error('An error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-background, #fafafa)' }}>
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div 
            className="w-[200px] h-[150px] mx-auto mb-6 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#eee6d2' }}
          >
            <img 
              src="/picpeak-logo-transparent.png" 
              alt="PicPeak"
              className="w-[180px] h-[130px] object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text, #171717)' }}>Admin Login</h1>
          <p className="mt-2" style={{ color: 'var(--color-text, #171717)', opacity: 0.7 }}>Sign in to manage your photo galleries</p>
        </div>

        {/* Login Form */}
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form Error */}
            {errors.form && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{errors.form}</p>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange('email')}
                error={errors.email}
                placeholder="admin@example.com"
                leftIcon={<Mail className="w-5 h-5 text-neutral-400" />}
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleInputChange('password')}
                  error={errors.password}
                  placeholder="Enter your password"
                  leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-neutral-700">Remember me</span>
              </label>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-700">
                Forgot password?
              </a>
            </div>

            {/* reCAPTCHA */}
            <ReCaptcha
              onChange={setRecaptchaToken}
              onExpired={() => setRecaptchaToken(null)}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              className="w-full"
            >
              Sign In
            </Button>
          </form>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm" style={{ color: 'var(--color-text, #171717)', opacity: 0.7 }}>
            Need help? Contact{' '}
            <a 
              href={`mailto:${settingsData?.branding_support_email || 'support@example.com'}`} 
              className="hover:underline"
              style={{ color: 'var(--color-primary, #5C8762)' }}
            >
              {settingsData?.branding_support_email || 'support@example.com'}
            </a>
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text, #171717)', opacity: 0.5 }}>
            Powered by <span className="font-semibold">PicPeak</span>
          </p>
        </div>

        {/* Development Hint */}
        {import.meta.env.DEV && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              <strong>Development Mode:</strong> Use email: admin@example.com, password: admin123
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

AdminLoginPage.displayName = 'AdminLoginPage';