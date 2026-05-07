const { db } = require('../database/db');
const logger = require('../utils/logger');

const SOCIAL_CRAWLER_PATTERNS = [
  /facebookexternalhit/i,
  /facebot/i,
  /Twitterbot/i,
  /WhatsApp/i,
  /Slackbot/i,
  /TelegramBot/i,
  /SkypeUriPreview/i,
  /Discordbot/i,
  /LinkedInBot/i,
  /Pinterest/i,
  /vkShare/i,
  /redditbot/i,
  /Embedly/i,
  /iframely/i,
  /Snapchat/i,
  /Applebot/i,
  /quora link preview/i,
  /Mastodon/i,
  /Bluesky/i,
  /OpenGraph/i,
  /opengraph/i
];

function isSocialCrawler(userAgent) {
  if (!userAgent) return false;
  return SOCIAL_CRAWLER_PATTERNS.some((re) => re.test(userAgent));
}

function parseSettingValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function fetchBranding() {
  const rows = await db('app_settings')
    .whereIn('setting_key', [
      'branding_company_name',
      'branding_company_tagline',
      'branding_logo_url'
    ]);

  const branding = { companyName: null, companyTagline: null, logoUrl: null };
  for (const row of rows) {
    const parsed = parseSettingValue(row.setting_value);
    switch (row.setting_key) {
    case 'branding_company_name':
      branding.companyName = parsed || null;
      break;
    case 'branding_company_tagline':
      branding.companyTagline = parsed || null;
      break;
    case 'branding_logo_url':
      branding.logoUrl = parsed || null;
      break;
    default:
      break;
    }
  }
  return branding;
}

async function resolveSlug(slug) {
  let event = await db('events').where('slug', slug).first();
  if (event) return event;
  // Honour slug redirects so renamed galleries still get rich previews.
  const hasRedirects = await db.schema.hasTable('event_slug_redirects');
  if (hasRedirects) {
    const redirect = await db('event_slug_redirects').where('old_slug', slug).first();
    if (redirect) {
      event = await db('events').where('slug', redirect.new_slug).first();
    }
  }
  return event || null;
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function absoluteUrl(maybeRelative, base) {
  if (!maybeRelative) return null;
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

function frontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function formatEventDate(value) {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
}

async function buildOgMetadata(slug, requestPath) {
  const event = await resolveSlug(slug);
  const branding = await fetchBranding();
  const base = frontendBase();
  const siteName = branding.companyName || 'PicPeak';
  const logoUrl = absoluteUrl(branding.logoUrl, base) || `${base}/picpeak-logo-transparent.png`;

  if (!event) {
    return {
      title: siteName,
      description: branding.companyTagline || 'Photo gallery shared with PicPeak.',
      image: logoUrl,
      url: `${base}${requestPath}`,
      siteName
    };
  }

  const eventName = event.event_name || 'Photo Gallery';
  const eventDate = formatEventDate(event.event_date);
  const titleParts = [eventName];
  if (siteName && siteName !== eventName) titleParts.push(siteName);
  const title = titleParts.join(' — ');

  let description;
  if (event.welcome_message) {
    description = String(event.welcome_message).replace(/\s+/g, ' ').trim().slice(0, 200);
  } else if (eventDate) {
    description = `Photo gallery from ${eventName} on ${eventDate}.`;
  } else {
    description = `Photo gallery from ${eventName}.`;
  }

  return {
    title,
    description,
    image: logoUrl,
    url: `${base}/gallery/${event.slug}`,
    siteName,
    eventName,
    eventDate
  };
}

function renderOgHtml(meta) {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const s = escapeHtml(meta.siteName);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${s}" />
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:image" content="${i}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />
  <link rel="canonical" href="${u}" />
</head>
<body>
  <h1>${t}</h1>
  <p>${d}</p>
  <p><a href="${u}">View gallery</a></p>
</body>
</html>`;
}

async function handleGalleryOgRequest(req, res) {
  try {
    const { slug } = req.params;
    if (!slug || !/^[a-zA-Z0-9_-]{1,255}$/.test(slug)) {
      res.status(400).type('text/plain').send('Invalid gallery slug');
      return;
    }
    const meta = await buildOgMetadata(slug, req.originalUrl);
    res.set('Cache-Control', 'public, max-age=300');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(renderOgHtml(meta));
  } catch (error) {
    logger.error('Failed to render gallery OG page', { error: error.message });
    res.status(500).type('text/plain').send('Internal server error');
  }
}

module.exports = {
  isSocialCrawler,
  buildOgMetadata,
  renderOgHtml,
  handleGalleryOgRequest
};
