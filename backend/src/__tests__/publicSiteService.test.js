jest.mock('../database/db', () => {
  const mockDb = jest.fn();
  return {
    db: mockDb,
    logActivity: jest.fn(),
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { db } = require('../database/db');
const { getPublicSitePayload, clearPublicSiteCache } = require('../services/publicSiteService');
const { sanitizeCss } = require('../utils/cssSanitizer');

const buildPublicSiteRows = (overrides = {}) => ([
  { setting_key: 'general_public_site_enabled', setting_value: JSON.stringify(overrides.enabled ?? true) },
  { setting_key: 'general_public_site_html', setting_value: JSON.stringify(overrides.html ?? '<h1>{{company_name}}</h1>') },
  { setting_key: 'general_public_site_custom_css', setting_value: JSON.stringify(overrides.css ?? "body { color: red; }") }
]);

const buildBrandingRows = (overrides = {}) => ([
  { setting_key: 'branding_company_name', setting_value: JSON.stringify(overrides.companyName ?? 'Willow & Pine Studio') },
  { setting_key: 'branding_company_tagline', setting_value: JSON.stringify(overrides.companyTagline ?? 'Stories told in colour and light.') },
  { setting_key: 'branding_support_email', setting_value: JSON.stringify(overrides.supportEmail ?? 'hello@example.com') },
  { setting_key: 'branding_logo_url', setting_value: JSON.stringify(overrides.logoUrl ?? '/uploads/logos/logo.png') },
  { setting_key: 'branding_footer_text', setting_value: JSON.stringify(overrides.footerText ?? 'Crafted with care for every celebration.') },
  { setting_key: 'theme_config', setting_value: JSON.stringify(overrides.themeConfig ?? {
    primaryColor: '#2563eb',
    accentColor: '#1d4ed8',
    backgroundColor: '#f8fafc',
    textColor: '#0f172a'
  }) }
]);

describe('publicSiteService', () => {
  beforeEach(() => {
    clearPublicSiteCache();
    jest.clearAllMocks();
  });

  it('sanitizes stored HTML by stripping script tags', async () => {
    const publicSiteRows = buildPublicSiteRows({ html: '<h1>{{company_name}}</h1><script>alert(1)</script>' });
    const brandingRows = buildBrandingRows();

    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(publicSiteRows) }));
    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(brandingRows) }));

    const payload = await getPublicSitePayload({ bypassCache: true });

    expect(payload.enabled).toBe(true);
    expect(payload.html).toContain('<h1>Willow & Pine Studio</h1>');
    expect(payload.html).not.toContain('<script');
    expect(payload.baseCss.length).toBeGreaterThan(0);
    expect(payload.branding.companyName).toBe('Willow & Pine Studio');
  });

  it('sanitizes custom CSS and removes dangerous patterns', async () => {
    const publicSiteRows = buildPublicSiteRows({
      css: "body { color: blue; } @import url('https://malicious.example/style.css'); div { background: url(\"javascript:alert(1)\"); }"
    });
    const brandingRows = buildBrandingRows();

    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(publicSiteRows) }));
    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(brandingRows) }));

    const payload = await getPublicSitePayload({ bypassCache: true });

    expect(payload.css).toContain('body { color: blue; }');
    expect(payload.css).not.toContain('@import');
    expect(payload.css).not.toContain('javascript:');
    // Client-side util should match server sanitization expectations
    const clientSanitized = sanitizeCss(publicSiteRows[2].setting_value ? JSON.parse(publicSiteRows[2].setting_value) : '');
    expect(clientSanitized).not.toContain('@import');
    expect(clientSanitized).not.toContain('javascript:');
  });

  it('injects branding tokens into the rendered payload', async () => {
    const publicSiteRows = buildPublicSiteRows({ html: '<section><h1>{{company_name}}</h1><p>{{company_tagline}}</p><a href="mailto:{{support_email}}">Get in touch</a></section>' });
    const brandingRows = buildBrandingRows({
      companyName: 'Aurora Collective',
      companyTagline: 'Modern photography for timeless celebrations.',
      supportEmail: 'studio@aurora.co',
      logoUrl: '/uploads/logos/aurora.png',
      themeConfig: {
        primaryColor: '#5C8762',
        accentColor: '#1d4ed8',
        backgroundColor: '#fafafa',
        textColor: '#171717'
      }
    });

    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(publicSiteRows) }));
    db.mockImplementationOnce(() => ({ whereIn: () => Promise.resolve(brandingRows) }));

    const payload = await getPublicSitePayload({ bypassCache: true });

    expect(payload.html).toContain('Aurora Collective');
    expect(payload.html).toContain('Modern photography for timeless celebrations.');
    expect(payload.html).toContain('studio@aurora.co');
    expect(payload.branding.logoUrl).toBe('/uploads/logos/aurora.png');
    expect(payload.branding.colors.primary).toBe('#5C8762');
  });
});
