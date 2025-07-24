import React from 'react';
import { MessageSquare, Star, Heart, Bookmark, Shield, Eye } from 'lucide-react';
import { Card } from '../common';
import { useTranslation } from 'react-i18next';

interface FeedbackSettingsProps {
  settings: FeedbackSettings;
  onChange: (settings: FeedbackSettings) => void;
  className?: string;
}

interface FeedbackSettings {
  feedback_enabled: boolean;
  allow_ratings: boolean;
  allow_likes: boolean;
  allow_comments: boolean;
  allow_favorites: boolean;
  require_name_email: boolean;
  moderate_comments: boolean;
  show_feedback_to_guests: boolean;
  enable_rate_limiting: boolean;
  rate_limit_window_minutes?: number;
  rate_limit_max_requests?: number;
}

export const FeedbackSettings: React.FC<FeedbackSettingsProps> = ({
  settings,
  onChange,
  className = ''
}) => {
  const { t } = useTranslation();

  const handleToggle = (field: keyof FeedbackSettings) => {
    onChange({
      ...settings,
      [field]: !settings[field]
    });
  };

  const handleNumberChange = (field: keyof FeedbackSettings, value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      onChange({
        ...settings,
        [field]: numValue
      });
    }
  };

  return (
    <Card className={className}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            {t('feedback.settings.title', 'Guest Feedback Settings')}
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.feedback_enabled}
              onChange={() => handleToggle('feedback_enabled')}
              className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-neutral-700">
              {t('feedback.settings.enableFeedback', 'Enable feedback')}
            </span>
          </label>
        </div>

        {settings.feedback_enabled && (
          <>
            {/* Feedback Types */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-neutral-700">
                {t('feedback.settings.feedbackTypes', 'Feedback Types')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={settings.allow_ratings}
                    onChange={() => handleToggle('allow_ratings')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <Star className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.ratings', 'Star Ratings')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.ratingsDesc', 'Allow guests to rate photos (1-5 stars)')}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={settings.allow_likes}
                    onChange={() => handleToggle('allow_likes')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <Heart className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.likes', 'Likes')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.likesDesc', 'Simple like/unlike functionality')}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={settings.allow_comments}
                    onChange={() => handleToggle('allow_comments')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <MessageSquare className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.comments', 'Comments')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.commentsDesc', 'Text comments on photos')}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={settings.allow_favorites}
                    onChange={() => handleToggle('allow_favorites')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <Bookmark className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.favorites', 'Favorites')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.favoritesDesc', 'Mark photos as favorites')}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t pt-4" />

            {/* Privacy & Moderation */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-neutral-700">
                {t('feedback.settings.privacyModeration', 'Privacy & Moderation')}
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_name_email}
                    onChange={() => handleToggle('require_name_email')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.requireInfo', 'Require Name & Email')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.requireInfoDesc', 'Guests must provide name and email to leave feedback')}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.moderate_comments}
                    onChange={() => handleToggle('moderate_comments')}
                    disabled={!settings.allow_comments}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500 disabled:opacity-50"
                  />
                  <Shield className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.moderateComments', 'Moderate Comments')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.moderateCommentsDesc', 'Comments require approval before being visible')}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.show_feedback_to_guests}
                    onChange={() => handleToggle('show_feedback_to_guests')}
                    className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                  />
                  <Eye className="w-5 h-5 text-neutral-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-neutral-900">
                      {t('feedback.settings.showToGuests', 'Show Feedback to Guests')}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {t('feedback.settings.showToGuestsDesc', 'Other guests can see ratings, likes, and approved comments')}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t pt-4" />

            {/* Rate Limiting */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.enable_rate_limiting}
                  onChange={() => handleToggle('enable_rate_limiting')}
                  className="w-4 h-4 text-primary-600 bg-neutral-100 border-neutral-300 rounded focus:ring-primary-500"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium text-neutral-900">
                    {t('feedback.settings.enableRateLimiting', 'Enable Rate Limiting')}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {t('feedback.settings.rateLimitingDesc', 'Prevent spam by limiting feedback frequency')}
                  </div>
                </div>
              </label>

              {settings.enable_rate_limiting && (
                <div className="grid grid-cols-2 gap-4 ml-7">
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      {t('feedback.settings.timeWindow', 'Time Window (minutes)')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.rate_limit_window_minutes || 15}
                      onChange={(e) => handleNumberChange('rate_limit_window_minutes', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1">
                      {t('feedback.settings.maxRequests', 'Max Requests')}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.rate_limit_max_requests || 10}
                      onChange={(e) => handleNumberChange('rate_limit_max_requests', e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};