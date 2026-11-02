// Stockly backend - zero dependencies. Run: node server.js
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000, KEY = process.env.ADMIN_KEY || 'admin123';
const DB = path.join(__dirname, 'data', 'messages.json');
fs.mkdirSync(path.dirname(DB), { recursive: true });
const read = () => { try { return JSON.parse(fs.readFileSync(DB, 'utf8')); } catch { return []; } };
const write = (m) => fs.writeFileSync(DB, JSON.stringify(m, null, 2));
const hits = {};

http.createServer((req, res) => {
  const send = (code, body, type = 'application/json') => {
    res.writeHead(code, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type,x-admin-key', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
    res.end(type === 'application/json' ? JSON.stringify(body) : body);
  };
  const url = req.url.split('?')[0];
  if (req.method === 'OPTIONS') return send(204, '', 'text/plain');
  if (req.method === 'GET' && (url === '/' || url === '/Stockly.html'))
    return send(200, fs.readFileSync(path.join(__dirname, 'Stockly.html')), 'text/html; charset=utf-8');

  if (url === '/api/contact' && req.method === 'POST') {
    const ip = req.socket.remoteAddress, now = Date.now();
    hits[ip] = (hits[ip] || []).filter((t) => now - t < 6e4);
    if (hits[ip].length >= 5) return send(429, { error: 'Too many messages. Please wait a minute.' });
    hits[ip].push(now);
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2e4) req.destroy(); });
    req.on('end', () => {
      let f; try { f = JSON.parse(body); } catch { return send(400, { error: 'Invalid request' }); }
      const c = (k) => String(f[k] || '').trim();
      const m = { id: now.toString(36) + Math.random().toString(36).slice(2, 5), date: new Date().toISOString(), name: c('name').slice(0, 80), email: c('email').slice(0, 120), phone: c('phone').slice(0, 20), subject: c('subject').slice(0, 120), message: c('message').slice(0, 2000) };
      if (!m.name || !/^\S+@\S+\.\S+$/.test(m.email) || m.message.length < 5) return send(400, { error: 'Please enter your name, a valid email and a message.' });
      const all = read(); all.unshift(m); write(all);
      send(201, { ok: true });
    });
    return;
  }
  if (url.startsWith('/api/messages')) {
    if (req.headers['x-admin-key'] !== KEY) return send(401, { error: 'Unauthorized' });
    if (req.method === 'GET' && url === '/api/messages') return send(200, read());
    const d = url.match(/^\/api\/messages\/(\w+)$/);
    if (req.method === 'DELETE' && d) { write(read().filter((m) => m.id !== d[1])); return send(200, { ok: true }); }
  }
  send(404, { error: 'Not found' });
}).listen(PORT, () => console.log('Stockly running at http://localhost:' + PORT));
