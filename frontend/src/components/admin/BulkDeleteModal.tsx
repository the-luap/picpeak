import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input } from '../common';
import type { Event } from '../../types';

interface BulkDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  selectedEvents: Event[];
  isLoading?: boolean;
  /** Set when the server responded 401 INVALID_PASSWORD; surfaces inline. */
  passwordError?: string | null;
  /** Clear the inline password error when the user starts typing again. */
  onPasswordErrorClear?: () => void;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  selectedEvents,
  isLoading = false,
  passwordError = null,
  onPasswordErrorClear,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  if (!isOpen) return null;

  const count = selectedEvents.length;

  const handleSubmit = async () => {
    if (!password || isLoading) return;
    await onConfirm(password);
  };

  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (passwordError && onPasswordErrorClear) onPasswordErrorClear();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
              {t('events.bulkDelete.title', 'Permanently delete {{count}} events?', { count })}
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
              disabled={isLoading}
              aria-label={t('common.close', 'Close')}
            >
              <X className="w-5 h-5 text-neutral-500 dark:text-neutral-400" />
            </button>
          </div>

          {/* Processing-state banner replaces the warning + form when in flight. */}
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin text-red-600 dark:text-red-400" />
              <p className="text-sm text-neutral-700 dark:text-neutral-300">
                {t('events.bulkDelete.processing', 'Deleting {{count}} events. This may take a few minutes — please don\'t close this window.', { count })}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {t('events.bulkDelete.warning', 'This will permanently delete the selected events, all their photos, archives, and audit logs. This action cannot be undone.')}
                </p>
              </div>

              <div className="border border-neutral-200 dark:border-neutral-700 rounded-lg max-h-40 overflow-y-auto mb-4">
                <ul className="p-3 space-y-1">
                  {selectedEvents.map((event) => (
                    <li key={event.id} className="text-sm text-neutral-700 dark:text-neutral-300">
                      • {event.event_name} ({event.event_type})
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  label={t('events.bulkDelete.passwordLabel', 'Re-enter your password to confirm')}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder={t('events.bulkDelete.passwordPlaceholder', 'Your admin password')}
                  helperText={t('events.bulkDelete.passwordHelp', 'We require your password as a safeguard against accidental bulk deletions.')}
                  error={passwordError || undefined}
                  leftIcon={<Lock className="w-5 h-5" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  }
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && password) handleSubmit();
                  }}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!password || isLoading}
                  leftIcon={<Trash2 className="w-4 h-4" />}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
                >
                  {t('events.bulkDelete.submit', 'Delete {{count}} events', { count })}
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};

BulkDeleteModal.displayName = 'BulkDeleteModal';
