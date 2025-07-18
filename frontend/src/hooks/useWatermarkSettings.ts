import { useState, useEffect } from 'react';
import { api } from '../config/api';

export function useWatermarkSettings() {
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        // Use public settings endpoint that doesn't require authentication
        const response = await api.get('/public/settings');
        setWatermarkEnabled(response.data.branding_watermark_enabled || false);
      } catch (error) {
        console.error('Failed to fetch watermark settings:', error);
        // Default to false if we can't fetch settings
        setWatermarkEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { watermarkEnabled, loading };
}