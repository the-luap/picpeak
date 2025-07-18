import React, { useEffect, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useQuery } from '@tanstack/react-query';
import { getApiBaseUrl } from '../../utils/url';

interface ReCaptchaProps {
  onChange: (token: string | null) => void;
  onExpired?: () => void;
  size?: 'normal' | 'compact';
}

export const ReCaptcha: React.FC<ReCaptchaProps> = ({ 
  onChange, 
  onExpired,
  size = 'normal' 
}) => {
  const recaptchaRef = React.useRef<ReCAPTCHA>(null);
  const [siteKey, setSiteKey] = useState<string>('');

  // Fetch public settings to get reCAPTCHA site key
  const { data: settings } = useQuery({
    queryKey: ['public-settings'],
    queryFn: async () => {
      const response = await fetch(`${getApiBaseUrl()}/public/settings`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (settings?.recaptcha_site_key) {
      setSiteKey(settings.recaptcha_site_key);
    }
  }, [settings]);

  // If reCAPTCHA is not enabled or site key is not available, return null
  if (!settings?.enable_recaptcha || !siteKey) {
    return null;
  }

  return (
    <div className="flex justify-center">
      <ReCAPTCHA
        ref={recaptchaRef}
        sitekey={siteKey}
        onChange={onChange}
        onExpired={onExpired}
        size={size}
        theme="light"
      />
    </div>
  );
};

export default ReCaptcha;