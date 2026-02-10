/**
 * Candela CRM - Servidor (Node.js)
 * Soporta PostgreSQL (Railway) o JSON (local)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data.json');

// PostgreSQL connection (if DATABASE_URL is provided)
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

// Initialize database tables
async function initDatabase() {
    if (!pool) return;

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS crm_data (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if we need to seed initial data
        // Forzar actualización de datos desde JSON local en cada despliegue
        // Esto asegura que la nube siempre refleje los datos del repositorio
        if (fs.existsSync(DATA_FILE)) {
            const initialData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
            await pool.query(
                `INSERT INTO crm_data (key, value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) 
                 DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
                ['main', initialData]
            );
            console.log('📥 Datos sincronizados: JSON Local -> PostgreSQL');
        }
        console.log('✅ Base de datos inicializada');
    } catch (error) {
        console.error('❌ Error inicializando DB:', error.message);
    }
}

// Get data (from PostgreSQL or JSON)
async function getData() {
    if (pool) {
        try {
            const result = await pool.query("SELECT value FROM crm_data WHERE key = 'main'");
            if (result.rows.length > 0) {
                return result.rows[0].value;
            }
        } catch (error) {
            console.error('Error reading from DB:', error.message);
        }
    }

    // Fallback to JSON file
    if (fs.existsSync(DATA_FILE)) {
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return {};
}

// Save data (to PostgreSQL or JSON)
async function saveData(data) {
    if (pool) {
        try {
            await pool.query(
                `INSERT INTO crm_data (key, value, updated_at) 
                 VALUES ('main', $1, CURRENT_TIMESTAMP)
                 ON CONFLICT (key) 
                 DO UPDATE SET value = $1, updated_at = CURRENT_TIMESTAMP`,
                [data]
            );
            return true;
        } catch (error) {
            console.error('Error writing to DB:', error.message);
        }
    }

    // Fallback to JSON file
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
}

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: GET data
    if (req.method === 'GET' && req.url === '/api/data') {
        try {
            const data = await getData();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // API: POST data
    if (req.method === 'POST' && req.url === '/api/data') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                await saveData(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // Health check
    if (req.method === 'GET' && req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            database: pool ? 'postgresql' : 'json',
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'text/plain';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

const localIP = getLocalIP();

// Start server after database init
initDatabase().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log('==================================================');
        console.log('🔥 CANDELA CRM - Servidor Iniciado');
        console.log('==================================================');
        console.log('');
        if (DATABASE_URL) {
            console.log('💾 Almacenamiento: PostgreSQL');
        } else {
            console.log('💾 Almacenamiento: JSON local');
            console.log('📍 Acceso desde PC:');
            console.log(`   http://localhost:${PORT}`);
            console.log('');
            console.log('📱 Acceso desde CELULAR (misma red WiFi):');
            console.log(`   http://${localIP}:${PORT}`);
        }
        console.log('');
        console.log('💡 Presiona Ctrl+C para detener el servidor');
        console.log('==================================================');
    });
});
