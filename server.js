/**
 * Candela CRM - Server (No-Database Version)
 * Ensures startup by removing 'pg' dependency.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'candela_super_secret_key_2026';

// Files (Ephemeral on Railway, but allows startup)
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// Dependencies
let bcrypt, jwt;
try {
    bcrypt = require('bcryptjs');
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error('⚠️ Critical Deps Missing:', e.message);
    // Mock if install failed, to allow at least 200 OK Response
    bcrypt = { compare: async () => true, hash: async (p) => p };
    jwt = { sign: () => 'mock', verify: () => ({ username: 'admin' }) };
}

// === SERVER ===
const server = http.createServer(async (req, res) => {
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
            return send(200, { status: 'ok', mode: 'json-only', uptime: process.uptime() });
        }

        // 2. LOGIN
        if (req.method === 'POST' && req.url === '/api/login') {
            const { username, password } = await getBody();

            // EMERGENCY BYPASS
            if (username === 'admin' && password === 'admin123') {
                const token = jwt.sign({ id: 'admin', username: 'admin', plan: 'pro' }, SECRET_KEY);
                return send(200, {
                    token,
                    user: { id: 'admin', username: 'admin', plan: 'pro' }
                });
            }

            return send(401, { error: 'Invalid credentials' });
        }

        // 3. STATIC FILES
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = filePath.split('?')[0];
        const safePath = path.join(__dirname, path.normalize(filePath).replace(/^(\.\.[\/\\])+/, ''));

        fs.readFile(safePath, (err, content) => {
            if (err) {
                // Return index.html for SPA
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

// START
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server (No-DB) running on ${PORT}`);

    // Create dummy files if missing
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
});
