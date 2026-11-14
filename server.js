'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const nodemailer = require('nodemailer');

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
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosiff' });
  response.end(JSON.stringify(body));
}

function createServer({ sender, transport }) {
  return http.createServer(async (request, response) => {
    if (request.headers.host !== `${host}:${port}`) {
      json(response, 403, { error: 'Invalid host.' });
      return;
    }
    const url = new URL(request.url, `http://${host}:${port}`);
    if (request.method === 'POST' && url.pathname === '/api/notify') {
      if (request.headers.origin !== `http://${host}:${port}` || !/^application\/json(?:\s*;|$)/i.test(request.headers['content-type'] || '')) {
        json(response, 403, { error: 'Invalid request origin or content type.' });
        return;
      }
      let raw = '';
      try {
        for await (const chunk of request) {
          raw += chunk;
          if (raw.length > 8192) {
            json(response, 413, { error: 'Request is too large.' });
            return;
          }
        }
      } catch (error) {
        console.error('Could not read notification request:', error.message);
        if (!response.destroyed) json(response, 400, { error: 'Could not read the request.' });
        return;
      }
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        json(response, 400, { error: 'Invalid request.' });
        return;
      }
      const name = typeof payload?.name === 'string' ? payload.name.trim() : '';
      const emails = Array.isArray(payload?.emails) ? payload.emails : [];
      if (!name || name.length > 80 || /[\r\n]/.test(name) || emails.length < 1 || emails.length > 10 ||
          emails.some((email) => typeof email !== 'string' || email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email))) {
        json(response, 400, { error: 'Enter a name and 1–10 valid email addresses.' });
        return;
      }
      if (!sender || !transport) {
        json(response, 503, { error: 'Gmail is not configured. Follow the Gmail setup instructions on the page and restart the server.' });
        return;
      }
      try {
        const result = await transport.sendMail({
          from: sender,
          to: sender,
          bcc: [...new Set(emails)],
          subject: 'A heads-up from someone you know',
          text: `${name} wanted to let you know they will be drinking alcohol. Please check in with them and help them get home safely.`
        });
        if (result.rejected.length) {
          json(response, 502, { error: 'Gmail accepted some recipients but rejected others. Check with recipients before retrying to avoid duplicate emails.' });
          return;
        }
        json(response, 200, { ok: true });
      } catch (error) {
        console.error('Gmail notification failed:', error.message);
        json(response, 502, { error: 'Gmail could not send the notification. Check your Gmail setup and server output before retrying.' });
      }
      return;
    }
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
  const sender = process.env.GMAIL_ADDRESS;
  const password = process.env.GMAIL_APP_PASSWORD;
  const transport = sender && password ? nodemailer.createTransport({
    service: 'gmail',
    auth: { user: sender, pass: password },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000
  }) : null;
  if (!transport) console.warn('Gmail is not configured. Set GMAIL_ADDRESS and GMAIL_APP_PASSWORD to enable notifications.');
  createServer({ sender, transport }).listen(port, host, () => {
    console.log(`Way Home is available at http://${host}:${port}`);
  });
}

module.exports = { createServer };
