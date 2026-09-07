/**
 * Passwords must not survive in the email archive (see the module header of
 * utils/emailSecretRedaction.js).
 */
const { secretValues, redactEmailData, redactRenderedHtml, replaceMaskedSecrets, parseEmailData, MASK } = require('../../src/utils/emailSecretRedaction');

describe('email secret redaction', () => {
  const data = {
    customer_name: 'Ada', gallery_link: 'https://p.example/gallery/x/tok',
    gallery_password: 'Sunset-42!', client_password: '1234', welcome_message: 'hi',
    attachments: [{ filename: 'a.pdf', password: 'zip-secret' }],
  };

  it('finds the secrets by key name, nested included, and skips sentinels', () => {
    expect(secretValues(data).sort()).toEqual(['1234', 'Sunset-42!', 'zip-secret']);
    expect(secretValues({ gallery_password: '{{password_security_message}}' })).toEqual([]);
    expect(secretValues({ gallery_password: 'No password required' })).toEqual([]);
    expect(secretValues({ gallery_password: '(set at creation)' })).toEqual([]);
    expect(secretValues({ gallery_password: '' })).toEqual([]);
  });

  it('masks the secrets in the variables and leaves everything else alone', () => {
    const redacted = redactEmailData(data);
    expect(redacted.gallery_password).toBe(MASK);
    expect(redacted.client_password).toBe(MASK);
    expect(redacted.attachments[0].password).toBe(MASK);
    expect(redacted.attachments[0].filename).toBe('a.pdf');
    expect(redacted.customer_name).toBe('Ada');
    expect(redacted.gallery_link).toBe(data.gallery_link);
    // sentinels stay readable
    expect(redactEmailData({ gallery_password: 'No password required' }).gallery_password).toBe('No password required');
    // the input is not mutated
    expect(data.gallery_password).toBe('Sunset-42!');
  });

  it('strips the secrets from the rendered HTML, plain and HTML-escaped', () => {
    const html = '<li>Password: Sunset-42!</li><li>PIN: 1234</li><p>Tom &amp; Ada&#39;s day</p>';
    const out = redactRenderedHtml(html, secretValues({ ...data, client_password: 'Tom & Ada\'s day' }));
    expect(out).toContain(`Password: ${MASK}`);
    expect(out).not.toContain('Sunset-42!');
    expect(out).toContain(`<p>${MASK}</p>`);
    expect(redactRenderedHtml(html, [])).toBe(html);
    expect(redactRenderedHtml(null, ['x'])).toBeNull();
  });

  it('parses stored email_data leniently', () => {
    expect(parseEmailData('{"a":1}')).toEqual({ a: 1 });
    expect(parseEmailData({ a: 1 })).toEqual({ a: 1 });
    expect(parseEmailData('not json')).toEqual({});
    expect(parseEmailData(null)).toEqual({});
  });

  it('ignores the pipeline sentinels but not a brace-wrapped real password', () => {
    expect(secretValues({ gallery_password: '(set at creation)', client_password: 'No password required' })).toEqual([]);
    expect(secretValues({ gallery_password: '{{Sunset-42!}}' })).toEqual(['{{Sunset-42!}}']);
  });

  it('replaceMaskedSecrets swaps archive masks for the security sentinel, leaves the rest', () => {
    const out = replaceMaskedSecrets({ customer_name: 'Ada', gallery_password: MASK, client_password: MASK, nested: { pin: MASK, note: MASK } });
    expect(out).toEqual({
      customer_name: 'Ada',
      gallery_password: '{{password_security_message}}',
      client_password: '{{password_security_message}}',
      nested: { pin: '{{password_security_message}}', note: MASK },
    });
  });

  it('masks a raw secret that the template turned into markup', () => {
    const html = '<p>PIN: Se<cr3t>Pin42! and Se&lt;cr3t&gt;Pin42!</p>';
    expect(redactRenderedHtml(html, ['Se<cr3t>Pin42!'])).toBe(`<p>PIN: ${MASK} and ${MASK}</p>`);
  });

  it('masks overlapping secrets completely and leaves markup alone', () => {
    const html = '<p>Password: Sunset-42! PIN: Sunset-42!7788</p><a href="https://x.example/?p=Sunset-42!" style="color:red" title=7788>href</a>';
    const out = redactRenderedHtml(html, ['Sunset-42!', 'Sunset-42!7788', 'href', 'style', '7788']);
    expect(out).toBe(`<p>Password: ${MASK} PIN: ${MASK}</p><a href="https://x.example/?p=${MASK}" style="color:red" title=${MASK}>${MASK}</a>`);
  });
});
