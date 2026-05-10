import { api } from '../config/api';

export type FeatureKey =
  | 'galleries'
  | 'reminderEmails'
  | 'calendar'
  | 'calendarBooking'
  | 'quotes'
  | 'bills'
  | 'messaging'
  | 'analytics'
  | 'userManagement'
  // Foundation flag for the customer-side surface (#354). Gates the
  // /customer/* routes (login, dashboard, profile, accept-invite,
  // reset-password) and the admin Customers management page. The
  // calendar / calendarBooking / quotes / bills / messaging flags
  // above hang off this — they only appear in the customer dashboard
  // when customerPortal is also ON.
  | 'customerPortal';

export type FeatureFlags = Record<FeatureKey, boolean>;

export const featureFlagsService = {
  async get(): Promise<FeatureFlags> {
    const response = await api.get<FeatureFlags>('/admin/feature-flags');
    return response.data;
  },

  async update(flags: Partial<FeatureFlags>): Promise<FeatureFlags> {
    const response = await api.put<FeatureFlags>('/admin/feature-flags', flags);
    return response.data;
  },
};
