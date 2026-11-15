'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('./server');

test('serves app pages and no longer exposes notification or sign-in endpoints', async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = (method, path) => new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, path, method, headers: { host: '127.0.0.1:3000' }
    }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  try {
    for (const page of ['/', '/drinks.html', '/check.html', '/transport.html', '/style.css']) {
      assert.equal(await request('GET', page), 200);
    }
    assert.equal(await request('POST', '/api/notify'), 404);
    assert.equal(await request('POST', '/auth/start'), 404);
    assert.equal(await request('GET', '/auth/callback'), 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
