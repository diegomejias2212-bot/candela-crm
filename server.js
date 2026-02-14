/**
 * Candela CRM - Emergency Server
 * Bypass Only. No DB. No filesystem complexity.
 */
const http = require('http');

// Config
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'candela_super_secret_key_2026';

// Minimal JWT mock if module missing, else try require
let jwt;
try { jwt = require('jsonwebtoken'); } catch (e) {
    jwt = { sign: () => 'mock_token_' + Date.now() };
    console.log('JWT missing, using mock');
}

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

    console.log(`REQ: ${req.method} ${req.url}`);

    try {
        // 1. Root & Health - Explicit JSON response to prove new code is running
        if (req.url === '/' || req.url === '/api/health') {
            return send(200, { status: 'ok', msg: 'Emergency Server Running', version: 'minimal' });
        }

        // 2. Login Bypass
        if (req.method === 'POST' && req.url === '/api/login') {
            const token = jwt.sign({ id: 'admin', username: 'admin' }, SECRET_KEY);
            return send(200, {
                token,
                user: { id: 'admin', username: 'admin', plan: 'pro' }
            });
        }

        // 3. Fallback for Static Files (Mocked just to prevent 404 on load)
        if (req.url === '/index.html' || req.url.endsWith('.html')) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Candela CRM Emergency Mode</h1><p>Backend is UP. Use API calls.</p>');
            return;
        }

        send(404, { error: 'Emergency Mode - Only Login Available' });

    } catch (e) {
        console.error(e);
        send(500, { error: e.message });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Emergency Server on ${PORT}`);
});
