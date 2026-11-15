'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const host = '127.0.0.1';
const port = 3000;
const allowedFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/drinks.html', ['drinks.html', 'text/html; charset=utf-8']],
  ['/check.html', ['check.html', 'text/html; charset=utf-8']],
  ['/transport.html', ['transport.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer(async (request, response) => {
    if (request.headers.host !== `${host}:${port}`) {
      json(response, 403, { error: 'Invalid host.' });
      return;
    }
    const url = new URL(request.url, `http://${host}:${port}`);
    const file = allowedFiles.get(url.pathname);
    if (request.method !== 'GET' || !file) {
      json(response, 404, { error: 'Not found.' });
      return;
    }
    try {
      const contents = await fs.readFile(path.join(__dirname, file[0]));
      response.writeHead(200, { 'Content-Type': file[1], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
      response.end(contents);
    } catch (error) {
      console.error('Could not serve page:', error.message);
      json(response, 500, { error: 'Could not load the page.' });
    }
  });
}

if (require.main === module) {
  createServer().listen(port, host, () => {
    console.log(`Way Home is available at http://${host}:${port}`);
  });
}

module.exports = { createServer };
