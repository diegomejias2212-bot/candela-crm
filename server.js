/**
 * Candela CRM - Servidor (Node.js) - Versión Resiliente
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// === CONFIG ===
const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'candela_super_secret_key_2026';
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// === DEPENDENCIES (Safe Load) ===
let bcrypt, jwt, pool;

try {
    bcrypt = require('bcryptjs');
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error('⚠️ Dependencias Auth faltantes. Usando modo inseguro/mock.');
    bcrypt = { compare: async (p, h) => p === h, hash: async (p) => p };
    jwt = { sign: (p, s) => 'mock_token', verify: (t, s) => ({ id: 'mock', username: 'mock' }) };
}

// PostgreSQL (Optional)
if (process.env.DATABASE_URL) {
    try {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log('📦 PostgreSQL configurado.');
    } catch (e) {
        console.error('❌ Error configurando PG:', e.message);
    }
}

// === HELPERS ===
function sendJSON(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

// === SERVER (Start Immediately) ===
const server = http.createServer(async (req, res) => {
    // CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end();
        return;
    }

    try {
        // 1. HEALTH CHECKS
        if (req.url === '/' || req.url === '/api/health') {
            return sendJSON(res, 200, { status: 'ok', uptime: process.uptime() });
        }

        const getBody = () => new Promise(resolve => {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', () => resolve(body ? JSON.parse(body) : {}));
        });

        // 2. LOGIN (Emergency Mode)
        if (req.method === 'POST' && req.url === '/api/login') {
            const { username, password } = await getBody();

            // 🚨 BYPASS DE EMERGENCIA
            if (username === 'admin' && password === 'admin123') {
                const token = jwt.sign({ id: 'admin', username: 'admin', plan: 'pro' }, SECRET_KEY);
                return sendJSON(res, 200, {
                    token,
                    user: { id: 'admin', username: 'admin', plan: 'pro' }
                });
            }

            // Normal login fallback (if users exist)
            let user;
            if (pool) {
                try {
                    const r = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
                    user = r.rows[0];
                } catch (e) { console.error('DB Login Error:', e); }
            } else if (fs.existsSync(USERS_FILE)) {
                try {
                    const users = JSON.parse(fs.readFileSync(USERS_FILE));
                    user = users.find(u => u.username === username);
                } catch (e) { }
            }

            if (user && (await bcrypt.compare(password, user.password))) {
                const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
                return sendJSON(res, 200, { token, user: { id: user.id, username: user.username } });
            }

            return sendJSON(res, 401, { error: 'Credenciales inválidas' });
        }

        // 3. STATIC FILES (Frontend)
        let filePath = req.url === '/' ? '/index.html' : req.url;
        // Strip query params
        filePath = filePath.split('?')[0];
        // Prevent path traversal
        const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
        const absPath = path.join(__dirname, safePath);

        // Default to index.html for unknown routes (SPA) if file doesn't exist? 
        // Or just 404. Let's try serving file.
        fs.readFile(absPath, (err, content) => {
            if (err) {
                if (req.url.startsWith('/api/')) {
                    return sendJSON(res, 404, { error: 'Not Found' });
                }
                // Try serving index.html fallback?
                fs.readFile(path.join(__dirname, 'index.html'), (e, index) => {
                    if (e) return sendJSON(res, 404, { error: 'Not Found' });
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(index);
                });
            } else {
                const ext = path.extname(absPath);
                const map = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
                res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
                res.end(content);
            }
        });

    } catch (fatal) {
        console.error('Fatal Request Error:', fatal);
        sendJSON(res, 500, { error: 'Internal Server Error' });
    }
});

// START LISTENING IMMEDIATELY
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);

    // Background Init (Doesn't block startup)
    initDatabase().catch(err => console.error('Background Init Failed:', err));
});

async function initDatabase() {
    // Try creating local files just in case
    try {
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
    } catch (e) { console.error('FS Init Error:', e.message); }

    if (pool) {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT, password TEXT);`);
    }
}
