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
// Helper: Authenticate
async function authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, SECRET_KEY);
        // Map username 'admin' to ID if needed, but we should rely on ID in token.
        // Wait, register returns ID. Login should return ID.
        // Let's ensure Login returns ID.
        if (pool) {
            const r = await pool.query('SELECT id FROM users WHERE username = $1', [decoded.username]);
            if (r.rows.length > 0) return { id: r.rows[0].id, username: decoded.username };
        }
        return { username: 'admin', id: 'admin' }; // Fallback for emergency admin
    } catch (e) { return null; }
}

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
                db: pool ? 'connected' : 'local-json',
                env_check: !!process.env.DATABASE_URL
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
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'No autorizado' });

            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, SECRET_KEY);
                if (decoded.username !== 'admin') return sendJSON(res, 403, { error: 'Acceso denegado: Solo admin' });
            } catch (e) { return sendJSON(res, 401, { error: 'Token inválido' }); }

            const { username, password, plan } = await getBody(req);
            const hashed = await bcrypt.hash(password, 10);
            const userPlan = plan || 'free';

            if (pool) {
                try {
                    const r = await pool.query(
                        'INSERT INTO users (username, password, plan) VALUES ($1, $2, $3) RETURNING id',
                        [username, hashed, userPlan]
                    );
                    return sendJSON(res, 201, { id: r.rows[0].id, username });
                } catch (e) { return sendJSON(res, 400, { error: 'Usuario ya existe' }); }
            } else {
                return sendJSON(res, 501, { error: 'DB required' });
            }
        }

        // 3.5 AUTH - LIST USERS (Admin Only)
        if (req.method === 'GET' && req.url === '/api/users') {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) return sendJSON(res, 401, { error: 'No autorizado' });

            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, SECRET_KEY);
                if (decoded.username !== 'admin') return sendJSON(res, 403, { error: 'Acceso denegado' });

                if (pool) {
                    const r = await pool.query('SELECT id, username, plan, created_at FROM users ORDER BY id ASC');
                    return sendJSON(res, 200, r.rows);
                } else {
                    return sendJSON(res, 200, []);
                }
            } catch (e) { return sendJSON(res, 401, { error: 'Token inválido' }); }
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

        // 4. GET DATA
        if (req.method === 'GET' && req.url === '/api/data') {
            const user = await authenticate(req);
            if (!user) return sendJSON(res, 401, { error: 'Unauthorized' });

            if (pool) {
                try {
                    const r = await pool.query('SELECT data FROM user_crm_data WHERE user_id = $1', [user.id]);
                    if (r.rows.length > 0) return sendJSON(res, 200, r.rows[0].data);
                    else return sendJSON(res, 200, {});
                } catch (e) { return sendJSON(res, 500, { error: e.message }); }
            } else {
                const data = JSON.parse(fs.readFileSync(DATA_FILE));
                return sendJSON(res, 200, data['main'] || {});
            }
        }

        // 5. POST DATA
        if (req.method === 'POST' && req.url === '/api/data') {
            const user = await authenticate(req);
            if (!user) return sendJSON(res, 401, { error: 'Unauthorized' });

            const body = await getBody(req);

            if (pool) {
                try {
                    const check = await pool.query('SELECT user_id FROM user_crm_data WHERE user_id = $1', [user.id]);
                    if (check.rows.length > 0) {
                        await pool.query('UPDATE user_crm_data SET data = $1, updated_at = NOW() WHERE user_id = $2', [JSON.stringify(body), user.id]);
                    } else {
                        await pool.query('INSERT INTO user_crm_data (user_id, data) VALUES ($1, $2)', [user.id, JSON.stringify(body)]);
                    }
                    return sendJSON(res, 200, { success: true });
                } catch (e) { return sendJSON(res, 500, { error: e.message }); }
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
                CREATE TABLE IF NOT EXISTS user_crm_data (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id),
                    data JSONB,
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
    console.log(`🚀 Server listening on ${PORT} `);
    initDatabase(); // Background init
});
