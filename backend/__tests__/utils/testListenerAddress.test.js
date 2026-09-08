const http = require('http');
it('directs Supertest to the actual IPv6 listener instead of an unrelated IPv4 port', async () => {
  jest.resetModules();
  const request = require('supertest');
  const server = http.createServer((_req, res) => { res.end('actual test listener'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '::1', resolve); });
  try {
    const response = await request(server).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toBe('actual test listener');
    expect(response.request.url).toContain('://[::1]:');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
