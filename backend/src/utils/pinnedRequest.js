/** Axios/Node lookup: connect only to the addresses vetted for this delivery.
 * Keep the original URL for Host, TLS SNI and certificate verification.
 * Disable environment proxies (which would resolve the destination themselves)
 * and redirects. No reusable agent/socket can carry an old DNS decision.
 */
const http = require('http');
const https = require('https');
function pinnedRequestOptions(check) {
  if (!check?.valid || !check.hostname || !check.addresses?.length) {
    throw new Error('A validated destination is required');
  }
  const addresses = check.addresses.map(({ address, family }) => ({ address, family }));
  const lookup = (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    if (hostname !== check.hostname) return callback(new Error('Destination hostname changed'));
    const family = typeof options === 'number' ? options : options?.family;
    const matches = family ? addresses.filter(a => a.family === family) : addresses;
    if (!matches.length) return callback(new Error('No validated address for requested family'));
    if (options?.all) return callback(null, matches);
    callback(null, matches[0].address, matches[0].family);
  };
  return {
    proxy: false, maxRedirects: 0,
    httpAgent: new http.Agent({ lookup, keepAlive: false }),
    httpsAgent: new https.Agent({ lookup, keepAlive: false }),
  };
}
module.exports = { pinnedRequestOptions };
