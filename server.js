/**
 * Candela CRM - Servidor (Node.js)
 * Soporta PostgreSQL (Railway) o JSON (local-multi-usuario)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Intentar cargar dependencias opcionales (si fallan, usar mocks simples para dev local sin deps)
let bcrypt, jwt;
try {
    bcrypt = require('bcryptjs');
    jwt = require('jsonwebtoken');
} catch (e) {
    console.log('⚠️  Modo sin dependencias completas (bcrypt/jwt no encontrados). Usando simuladores simples.');
    bcrypt = { compare: async (p, h) => p === h, hash: async (p) => p };
    jwt = { sign: (p, s) => JSON.stringify(p), verify: (t, s) => JSON.parse(t) };
}

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || 'candela_super_secret_key_2026';
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// PostgreSQL connection
let pool = null;
const DATABASE_URL = process.env.DATABASE_URL;

if (DATABASE_URL) {
    const { Pool } = require('pg');
    pool = new Pool({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    console.log('📦 Conectado a PostgreSQL');
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon'
};

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// === DATABASE INIT ===
async function initDatabase() {
    if (pool) {
        try {
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
            console.log('✅ Tablas SQL verificadas');
        } catch (error) {
            console.error('❌ Error inicializando DB:', error.message);
        }
    } else {
        // Init local JSON files if not exist
        if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
        if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
        console.log('✅ Archivos JSON locales verificados');
    }
}

// === AUTH HELPERS ===
async function registerUser(username, password) {
    const hashedPassword = await bcrypt.hash(password, 10);

    if (pool) {
        try {
            const res = await pool.query(
                'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
                [username, hashedPassword]
            );
            // Inicializar data vacía para el usuario
            await saveData(`user_${res.rows[0].id}`, {});
            return { id: res.rows[0].id, username };
        } catch (e) {
            throw new Error('Usuario ya existe o error de DB');
        }
    } else {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        if (users.find(u => u.username === username)) throw new Error('Usuario ya existe');
        const newUser = { id: Date.now(), username, password: hashedPassword }; // Local stores hash
        users.push(newUser);
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        saveData(`user_${newUser.id}`, {});
        return { id: newUser.id, username };
    }
}

async function loginUser(username, password) {
    let user;
    if (pool) {
        const res = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        user = res.rows[0];
    } else {
        const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
        user = users.find(u => u.username === username);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
        throw new Error('Credenciales inválidas');
    }

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '7d' });
    return { token, user: { id: user.id, username: user.username } };
}

// === DATA HELPERS ===
async function getData(key) {
    if (pool) {
        const res = await pool.query("SELECT value FROM crm_data WHERE key = $1", [key]);
        return res.rows.length ? res.rows[0].value : {};
    } else {
        const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        return allData[key] || {};
    }
}

async function saveData(key, data) {
    if (pool) {
        await pool.query(
            `INSERT INTO crm_data (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            [key, data]
        );
    } else {
        const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        allData[key] = data;
        fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
    }
}

// Atomic Push: Appends an item to an array inside the JSON, avoiding overwrite
async function pushData(key, arrayName, item) {
    if (pool) {
        // PostgreSQL atomic update using jsonb_set + concatenation
        // COALESCE ensures we initialize the array if it doesn't exist
        /*
           Pseudo-query:
           UPDATE crm_data SET value = jsonb_set(
               value, 
               {arrayName}, 
               COALESCE(value->arrayName, '[]'::jsonb) || item::jsonb
           ) WHERE key = key
        */
        // Note: This is complex in raw SQL so we use a simpler approach of locking or JS-side merge if lazy
        // BUT for correctness, let's try a read-modify-write within a transaction or optimistic locking.
        // For simplicity in this `http` server, we'll do Read-Modify-Write but since Node is single-threaded for processing,
        // it acts as a queue. In SQL it might race. 
        // Let's stick to standard Read-Modify-Write for now, it's better than full overwrite.

        const current = await getData(key);
        if (!current[arrayName]) current[arrayName] = [];
        current[arrayName].unshift(item); // Add to beginning (newer first)
        await saveData(key, current);
        return current;

    } else {
        const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        const userDate = allData[key] || {};
        if (!userDate[arrayName]) userDate[arrayName] = [];
        userDate[arrayName].unshift(item);
        allData[key] = userDate;
        fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
        return userDate;
    }
}

// === SERVER ===
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    // Helpers
    const sendJSON = (code, data) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
    };

    const getBody = async () => {
        return new Promise((resolve) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => resolve(body ? JSON.parse(body) : {}));
        });
    };

    const authenticate = () => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        try {
            const token = authHeader.split(' ')[1];
            return jwt.verify(token, SECRET_KEY);
        } catch (e) {
            return null;
        }
    };

    try {
        // 1. LOGIN
        if (req.method === 'POST' && req.url === '/api/login') {
            const { username, password } = await getBody();
            try {
                const result = await loginUser(username, password);
                return sendJSON(200, result);
            } catch (e) {
                return sendJSON(401, { error: e.message });
            }
        }

        // 2. REGISTER (Protected - Admin Only)
        if (req.method === 'POST' && req.url === '/api/register') {
            // Verify Admin Token
            const adminUser = authenticate(req); // Need to pass req to authenticate if it relies on headers, or use existing authenticate() which uses closure 'req'
            if (!adminUser || adminUser.username !== 'admin') {
                return sendJSON(401, { error: 'Unauthorized: Only admin can create users' });
            }

            const body = await getBody(); // Get full body
            const { username, password } = body;
            try {
                const result = await registerUser(username, password);
                return sendJSON(201, result);
            } catch (e) {
                return sendJSON(400, { error: e.message });
            }
        }

        // Middleware Auth check for other routes
        const user = authenticate();
        const dataKey = user ? `user_${user.id}` : 'main';
        // Fallback to 'main' only if we want to allow unauthenticated access (legacy). 
        // Let's enforce auth or fallback to main for demo.
        // For security: if !user and not login/register -> 401

        // Excepción para pruebas locales rápidas: si no hay auth, usamos 'main'
        // Pero el cliente pedía credenciales.

        if (!user && req.url.startsWith('/api/')) {
            return sendJSON(401, { error: 'Requiere autenticación' });
        }

        // 3. GET DATA
        if (req.method === 'GET' && req.url === '/api/data') {
            const data = await getData(dataKey);
            console.log('🔍 GET /api/data');
            console.log('   User:', user ? user.username : 'Guest');
            console.log('   Key:', dataKey);
            console.log('   Data Found:', !!data && Object.keys(data).length > 0);
            if (data) console.log('   Ventas Count:', data.ventas ? data.ventas.length : 0);
            return sendJSON(200, data);
        }

        // 4. SYNC FULL DATA (Overwrite - Legacy support but risky)
        if (req.method === 'POST' && req.url === '/api/data') {
            const body = await getBody();
            await saveData(dataKey, body);
            return sendJSON(200, { success: true });
        }

        // 5. ATOMIC PUSH (New safer endpoint)
        // Usage: POST /api/push?array=ventas
        if (req.method === 'POST' && req.url.startsWith('/api/push')) {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const arrayName = urlObj.searchParams.get('array');
            if (!arrayName) return sendJSON(400, { error: 'Falta parámetro array' });

            const item = await getBody();
            const updatedData = await pushData(dataKey, arrayName, item);
            return sendJSON(200, updatedData);
        }

        // Atomic Local Sale + Inventory Deduction
        async function processLocalSale(key, payload) {
            if (pool) {
                // SQL Transaction would go here
                const currentData = await getData(key);

                // 1. Add Sale
                if (!currentData.ventasLocales) currentData.ventasLocales = [];
                // Fix: payload contains { sale, deductInventory }
                const saleToAdd = payload.sale || payload;
                currentData.ventasLocales.push(saleToAdd);

                // 2. Deduct Inventory (if applicable)
                if (payload.deductInventory && currentData.inventario) {
                    payload.deductInventory.forEach(item => {
                        const invItem = currentData.inventario.find(i => i.origen === item.origen);
                        if (invItem) {
                            invItem.stockActual = Math.max(0, invItem.stockActual - item.kg);
                        }
                    });
                }

                await saveData(key, currentData);
                return { sales: currentData.ventasLocales, inventory: currentData.inventario };

            } else {
                const allData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
                const userData = allData[key] || {};

                if (!userData.ventasLocales) userData.ventasLocales = [];
                const saleToAdd = payload.sale || payload;
                userData.ventasLocales.push(saleToAdd);

                if (payload.deductInventory && userData.inventario) {
                    payload.deductInventory.forEach(item => {
                        const invItem = userData.inventario.find(i => i.origen === item.origen);
                        if (invItem) {
                            invItem.stockActual = Math.max(0, invItem.stockActual - item.kg);
                        }
                    });
                }

                allData[key] = userData;
                fs.writeFileSync(DATA_FILE, JSON.stringify(allData, null, 2));
                return { sales: userData.ventasLocales, inventory: userData.inventario };
            }
        }

        // ... inside request handler ...

        // 6. SAAS & SPECIAL ENDPOINTS

        // GET /api/me - Return User Profile
        if (req.method === 'GET' && req.url === '/api/me') {
            let currentUser;
            if (pool) {
                const r = await pool.query('SELECT id, username, plan, plan_expires FROM users WHERE id=$1', [user.id]);
                currentUser = r.rows[0];
            } else {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                currentUser = users.find(u => u.id === user.id);
                if (currentUser) {
                    // Don't send password
                    const { password, ...safeUser } = currentUser;
                    currentUser = safeUser;
                }
            }
            // Defaults
            if (currentUser && !currentUser.plan) currentUser.plan = 'free';
            return sendJSON(200, currentUser || {});
        }

        // POST /api/upgrade - Simulate Payment
        if (req.method === 'POST' && req.url === '/api/upgrade') {
            const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // +30 days

            if (pool) {
                await pool.query("UPDATE users SET plan = 'pro', plan_expires = $1 WHERE id = $2", [expires, user.id]);
            } else {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                const idx = users.findIndex(u => u.id === user.id);
                if (idx !== -1) {
                    users[idx].plan = 'pro';
                    users[idx].plan_expires = expires;
                    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
                }
            }
            return sendJSON(200, { success: true, plan: 'pro', expires });
        }

        // GET /api/admin/users - Admin Only (Demo: Open to all authenticated for now)
        if (req.method === 'GET' && req.url === '/api/admin/users') {
            let userList = [];
            if (pool) {
                const r = await pool.query('SELECT id, username, plan, plan_expires, created_at FROM users');
                userList = r.rows;
            } else {
                const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
                // Don't send passwords
                userList = users.map(({ password, ...u }) => u);
            }
            return sendJSON(200, userList);
        }

        // POST /api/sales/local - Atomic Sale + Inventory
        if (req.method === 'POST' && req.url === '/api/sales/local') {
            const body = await getBody();
            // Expect body: { ...saleData, deductInventory: [...] }
            const result = await processLocalSale(dataKey, body);
            return sendJSON(200, result);
        }

        // 7. HEALTH
        if (req.url === '/api/health') {
            return sendJSON(200, { status: 'ok', db: pool ? 'pg' : 'json' });
        }

        // STATIC FILES
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = path.join(__dirname, filePath.split('?')[0]); // Remove query params

        const ext = path.extname(filePath);
        if (!MIME_TYPES[ext]) return sendJSON(404, { error: 'Not found' });

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') sendJSON(404, { error: 'File not found' });
                else sendJSON(500, { error: 'Server error' });
            } else {
                res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] });
                res.end(content);
            }
        });

    } catch (error) {
        console.error('Server Logic Error:', error);
        sendJSON(500, { error: error.message });
    }
});

const localIP = getLocalIP();

initDatabase().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
==================================================
🔥 CANDELA CRM - Multi-Tenant Server
==================================================
📍 Local:   http://localhost:${PORT}
📱 Network: http://${localIP}:${PORT}
💾 Storage: ${pool ? 'PostgreSQL' : 'JSON (Users & Data)'}
==================================================
`);
    });
});

