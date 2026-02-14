/**
 * Candela CRM - Servidor Producción (Railway + PostgreSQL)
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

// Mime Types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

// === DEPENDENCIES ===
let bcrypt, jwt, pool;

try {
    bcrypt = require('bcryptjs');
    jwt = require('jsonwebtoken');
} catch (e) {
    console.error('⚠️ Dependencias Auth faltantes:', e.message);
    // Mock para que no crashee, pero el login real fallará si no están
    bcrypt = { compare: async () => false, hash: async (p) => p };
    jwt = { sign: () => '', verify: () => null };
}

// PostgreSQL Connection
if (process.env.DATABASE_URL) {
    try {
        const { Pool } = require('pg');
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        console.log('📦 PostgreSQL conectado.');
    } catch (e) {
        console.error('❌ Error configurando PG:', e.message);
    }
}

// === HELPERS ===
function sendJSON(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

const getBody = (req) => new Promise(resolve => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => resolve(body ? JSON.parse(body) : {}));
});

// === SERVER ===
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    try {
        // 1. HEALTH
        if (req.url === '/api/health') {
            return sendJSON(res, 200, {
                status: 'ok',
                uptime: process.uptime(),
                db: pool ? 'connected' : 'local-json'
            });
        }

        // 2. AUTH - LOGIN
        if (req.method === 'POST' && req.url === '/api/login') {
            const { username, password } = await getBody(req);

            // 🚨 Emergency Bypass (Mantener por ahora como backup)
            if (username === 'admin' && password === 'admin123') {
                const token = jwt.sign({ id: 'admin_rescue', username: 'admin', plan: 'pro' }, SECRET_KEY);
                return sendJSON(res, 200, { token, user: { id: 'admin', username: 'admin', plan: 'pro' } });
            }

            let user;
            if (pool) {
                const r = await pool.query('SELECT * FROM users WHERE username=$1', [username]);
                user = r.rows[0];
            } else {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                user = users.find(u => u.username === username);
            }

            if (user && (await bcrypt.compare(password, user.password))) {
                const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
                return sendJSON(res, 200, { token, user: { id: user.id, username: user.username, plan: user.plan } });
            }
            return sendJSON(res, 401, { error: 'Credenciales inválidas' });
        }

        // 3. AUTH - REGISTER (Admin Only)
        if (req.method === 'POST' && req.url === '/api/register') {
            // Check auth header logic here if stricter security needed
            const { username, password } = await getBody(req);
            const hashed = await bcrypt.hash(password, 10);

            if (pool) {
                try {
                    const r = await pool.query(
                        'INSERT INTO users (username, password, plan) VALUES ($1, $2, $3) RETURNING id',
                        [username, hashed, 'free']
                    );
                    return sendJSON(res, 201, { id: r.rows[0].id, username });
                } catch (e) { return sendJSON(res, 400, { error: 'Usuario ya existe' }); }
            } else {
                // Local logic...
                return sendJSON(res, 501, { error: 'Not implemented locally fully' });
            }
        }

        // 2.5 AUTH - ME (Session Check)
        if (req.method === 'GET' && req.url === '/api/me') {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return sendJSON(res, 401, { error: 'No token' });
            }
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                return sendJSON(res, 200, decoded);
            } catch (e) {
                return sendJSON(res, 401, { error: 'Invalid token' });
            }
        }

        // 4. DATA - GET
        if (req.method === 'GET' && req.url === '/api/data') {
            // Extract user from token manually for simplicity
            // In prod: Implementation of verifyToken middleware
            if (pool) {
                const r = await pool.query("SELECT value FROM crm_data WHERE key = 'main'"); // Using 'main' as global key for MVP
                return sendJSON(res, 200, r.rows[0]?.value || {});
            } else {
                const data = JSON.parse(fs.readFileSync(DATA_FILE));
                return sendJSON(res, 200, data['main'] || {});
            }
        }

        // 5. DATA - SAVE (Sync)
        if (req.method === 'POST' && req.url === '/api/data') {
            const body = await getBody(req);
            if (pool) {
                await pool.query(
                    `INSERT INTO crm_data (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                    ['main', JSON.stringify(body)]
                );
            } else {
                const data = JSON.parse(fs.readFileSync(DATA_FILE));
                data['main'] = body;
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            }
            return sendJSON(res, 200, { success: true });
        }

        // 6. STATIC FILES
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = filePath.split('?')[0];
        const safePath = path.join(__dirname, path.normalize(filePath).replace(/^(\.\.[\/\\])+/, ''));

        fs.readFile(safePath, (err, content) => {
            if (err) {
                if (req.url.startsWith('/api/')) return sendJSON(res, 404, { error: 'Not Found' });
                fs.readFile(path.join(__dirname, 'index.html'), (e, index) => {
                    if (e) return sendJSON(res, 404, { error: 'UI Not Found' });
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(index);
                });
            } else {
                const ext = path.extname(safePath);
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'text/plain' });
                res.end(content);
            }
        });

    } catch (e) {
        console.error('SERVER ERROR:', e);
        sendJSON(res, 500, { error: 'Internal Error' });
    }
});

// === INIT & START ===
async function initDatabase() {
    // 1. Local Files
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

    // 2. PostgreSQL Schema
    if (pool) {
        try {
            console.log('🔄 Sincronizando esquema de base de datos...');
            await pool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    plan VARCHAR(20) DEFAULT 'free',
                    plan_expires TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                CREATE TABLE IF NOT EXISTS crm_data (
                    key VARCHAR(255) PRIMARY KEY,
                    value JSONB NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);

            // 3. Seed Admin
            const r = await pool.query("SELECT count(*) FROM users");
            if (parseInt(r.rows[0].count) === 0) {
                console.log('🌱 Creando usuario admin por defecto en DB...');
                const hash = await bcrypt.hash('admin123', 10);
                await pool.query(
                    "INSERT INTO users (username, password, plan) VALUES ($1, $2, $3)",
                    ['admin', hash, 'pro']
                );
                console.log('✅ Admin DB creado.');
            }
        } catch (e) {
            console.error('❌ Error DB Init:', e);
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server listening on ${PORT}`);
    initDatabase(); // Background init
});
