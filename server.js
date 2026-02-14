/**
 * Candela CRM - Pure Node Server (Zero Dependencies)
 * Implements simplified JWT manually to avoid build issues.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'candela_super_secret_key_2026';

// === HELPER: Manual JWT Generation (HS256) ===
function signToken(payload) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const h = Buffer.from(JSON.stringify(header)).toString('base64url');
    const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET_KEY)
        .update(`${h}.${p}`)
        .digest('base64url');
    return `${h}.${p}.${signature}`;
}

// === SERVER ===
const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    const send = (code, data) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const getBody = () => new Promise(resolve => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => resolve(body ? JSON.parse(body) : {}));
    });

    try {
        console.log(`[REQ] ${req.method} ${req.url}`);

        // 1. HEALTH CHECKS
        if (req.url === '/' || req.url === '/api/health') {
            return send(200, { status: 'ok', mode: 'pure-node', uptime: process.uptime() });
        }

        // 2. LOGIN (Emergency Bypass)
        if (req.method === 'POST' && req.url === '/api/login') {
            getBody().then(({ username, password }) => {
                if (username === 'admin' && password === 'admin123') {
                    const user = { id: 'admin', username: 'admin', plan: 'pro' };
                    return send(200, {
                        token: signToken(user),
                        user
                    });
                }
                send(401, { error: 'Invalid credentials' });
            });
            return;
        }

        // 3. STATIC FILES
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = filePath.split('?')[0];
        const safePath = path.join(__dirname, path.normalize(filePath).replace(/^(\.\.[\/\\])+/, ''));

        fs.readFile(safePath, (err, content) => {
            if (err) {
                fs.readFile(path.join(__dirname, 'index.html'), (e, index) => {
                    if (e) return send(404, { error: 'Not Found' });
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(index);
                });
            } else {
                const ext = path.extname(safePath);
                const map = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
                res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
                res.end(content);
            }
        });

    } catch (e) {
        console.error('Server Error:', e);
        send(500, { error: e.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Pure Node Server running on ${PORT}`);
});
