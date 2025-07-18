import React, { useState } from 'react';
import { X, Key, Copy, CheckCircle, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import { Button, Card } from '../common';

interface PasswordResetModalProps {
  eventName: string;
  onConfirm: (sendEmail: boolean) => Promise<{ newPassword: string; emailSent: boolean }>;
  onClose: () => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  eventName,
  onConfirm,
  onClose
}) => {
  const [isResetting, setIsResetting] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      const result = await onConfirm(sendEmail);
      setNewPassword(result.newPassword);
      toast.success('Password reset successfully');
    } catch (error) {
      toast.error('Failed to reset password');
      onClose();
    } finally {
      setIsResetting(false);
    }
  };

  const handleCopy = async () => {
    if (newPassword) {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      toast.success('Password copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            {newPassword ? 'New Password' : 'Reset Gallery Password'}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!newPassword ? (
          <>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to reset the password for <strong>{eventName}</strong>?
              This will generate a new password for gallery access.
            </p>

            <div className="mb-6">
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

            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                New Gallery Password
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPassword}
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