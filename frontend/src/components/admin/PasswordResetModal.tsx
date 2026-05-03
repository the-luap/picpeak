import React, { useState } from 'react';
import { X, Key, Copy, CheckCircle, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, Card, Input, PasswordGenerator } from '../common';

interface PasswordResetModalProps {
  eventName: string;
  eventDate?: string;
  eventType?: string;
  onConfirm: (sendEmail: boolean, password?: string) => Promise<{ newPassword: string; emailSent: boolean }>;
  onClose: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  eventName,
  eventDate,
  eventType,
  onConfirm,
  onClose
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [isResetting, setIsResetting] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [resultPassword, setResultPassword] = useState<string | null>(null);
  const [resultWasGenerated, setResultWasGenerated] = useState(false);
  const [copied, setCopied] = useState(false);

  const validate = (): boolean => {
    const next: typeof errors = {};
    // Empty is allowed → server auto-generates. Only validate when typed.
    if (password) {
      if (password.length < 6) {
        next.password = 'Password must be at least 6 characters';
      }
      if (password !== confirmPassword) {
        next.confirmPassword = 'Passwords do not match';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setIsResetting(true);
    try {
      const supplied = password.length > 0 ? password : undefined;
      const result = await onConfirm(sendEmail, supplied);
      setResultPassword(result.newPassword);
      setResultWasGenerated(!supplied);
      if (supplied) {
        toast.success('Password reset successfully');
      }
    } catch (error: any) {
      const serverError = error?.response?.data;
      if (serverError?.error === 'Password does not meet security requirements') {
        setErrors({ password: serverError.feedback?.join?.(' ') || 'Password does not meet security requirements' });
      } else {
        toast.error(serverError?.error || 'Failed to reset password');
      }
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = async () => {
    if (resultPassword) {
      await navigator.clipboard.writeText(resultPassword);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePasswordGenerated = (generated: string) => {
    setPassword(generated);
    setConfirmPassword(generated);
    setErrors({});
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            {resultPassword ? 'New Password' : 'Reset Gallery Password'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!resultPassword ? (
          <>
            <p className="text-neutral-600 mb-4">
              Set a new password for <strong>{eventName}</strong>, or leave both fields empty to have one auto-generated.
            </p>

            <div className="space-y-4 mb-4">
              <div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="New password"
                  placeholder="Leave empty to auto-generate"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  error={errors.password}
                  helperText="Use 6+ characters, or leave blank to auto-generate"
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                />

                <div className="mt-2">
                  <PasswordGenerator
                    eventName={eventName}
                    eventDate={eventDate}
                    eventType={eventType}
                    onPasswordGenerated={handlePasswordGenerated}
                    passwordComplexity="moderate"
                    className="w-full"
                  />
                </div>
              </div>

              {password.length > 0 && (
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label="Confirm password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                  }}
                  error={errors.confirmPassword}
                  leftIcon={<Lock className="w-5 h-5" />}
                />
              )}
            </div>

            <div className="mb-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500 focus:ring-2"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-neutral-500" />
                    <span className="text-sm font-medium text-neutral-700">
                      Send email notification
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Notify the host about the password change
                  </p>
                </div>
              </label>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> The old password will no longer work.
                Make sure to share the new password with the host.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isResetting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleReset}
                disabled={isResetting}
                isLoading={isResetting}
                leftIcon={<Key className="w-4 h-4" />}
                className="flex-1"
              >
                Reset Password
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="font-medium text-green-900">Password reset successfully!</p>
              </div>
              {sendEmail && (
                <p className="text-sm text-green-700">
                  An email notification has been sent to the host.
                </p>
              )}
            </div>

            {resultWasGenerated && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Auto-generated gallery password
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={resultPassword}
                      readOnly
                      className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-300 rounded-lg font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      onClick={handleCopy}
                      leftIcon={copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-sm text-blue-800">
                    <strong>Important:</strong> Save this password securely. It cannot be recovered once you close this window.
                  </p>
                </div>
              </>
            )}

            <Button
              variant="primary"
              onClick={onClose}
              className="w-full"
            >
              Done
            </Button>
          </>
        )}
      </Card>
    </div>
  );
};
