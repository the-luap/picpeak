import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useMutation } from '@tanstack/react-query';

import { Button, Input, Card } from '../common';
import { adminService } from '../../services/admin.service';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const changePasswordMutation = useMutation({
    mutationFn: adminService.changePassword,
    onSuccess: () => {
      toast.success('Password changed successfully');
      onClose();
      // Reset form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setErrors({});
    },
    onError: (error: any) => {
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Failed to change password');
      }
    }
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    changePasswordMutation.mutate({
      currentPassword: formData.currentPassword,
      newPassword: formData.newPassword
    });
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-neutral-900">Change Password</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-neutral-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                Current Password
              </label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={handleInputChange('currentPassword')}
                  error={errors.currentPassword}
                  placeholder="Enter current password"
                  leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-2 p-1 hover:bg-neutral-100 rounded"
                >
                  {showPasswords.current ? 
                    <EyeOff className="w-4 h-4 text-neutral-500" /> : 
                    <Eye className="w-4 h-4 text-neutral-500" />
                  }
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleInputChange('newPassword')}
                  error={errors.newPassword}
                  placeholder="Enter new password"
                  leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-2 p-1 hover:bg-neutral-100 rounded"
                >
                  {showPasswords.new ? 
                    <EyeOff className="w-4 h-4 text-neutral-500" /> : 
                    <Eye className="w-4 h-4 text-neutral-500" />
                  }
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-neutral-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleInputChange('confirmPassword')}
                  error={errors.confirmPassword}
                  placeholder="Confirm new password"
                  leftIcon={<Lock className="w-5 h-5 text-neutral-400" />}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-2 p-1 hover:bg-neutral-100 rounded"
                >
                  {showPasswords.confirm ? 
                    <EyeOff className="w-4 h-4 text-neutral-500" /> : 
                    <Eye className="w-4 h-4 text-neutral-500" />
                  }
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Password Requirements:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>At least 6 characters long</li>
                    <li>Must be different from current password</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={changePasswordMutation.isPending}
              >
                Change Password
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};