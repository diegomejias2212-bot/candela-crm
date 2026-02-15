const fs = require('fs');
const path = require('path');
const https = require('https');

const REMOTE_URL = 'https://web-production-8f0c.up.railway.app';
const DATA_FILE = path.join(__dirname, 'data.json');

function request(endpoint, method, body, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(REMOTE_URL + endpoint);
        const options = {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
                } else reject(new Error(`Status ${res.statusCode}: ${data}`));
            });
        });
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function run() {
    console.log('🚀 Restaurando datos a PostgreSQL...');

    if (!fs.existsSync(DATA_FILE)) return console.error('❌ data.json no encontrado');
    const rawData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    // Find the real data object
    let payload = rawData;
    const keys = Object.keys(rawData);
    const legacyKey = keys.find(k => k.startsWith('user_'));

    if (legacyKey) {
        console.log(`📦 Encontrada estructura legacy: ${legacyKey}. Aplanando...`);
        payload = rawData[legacyKey];
    } else if (rawData.admin) {
        console.log('📦 Encontrada estructura admin. Aplanando...');
        payload = rawData.admin;
    }

    try {
        // 1. Login
        const auth = await request('/api/login', 'POST', { username: 'admin', password: 'admin123' });
        console.log('✅ Login exitoso.');

        // 2. Upload
        await request('/api/data', 'POST', payload, auth.token);
        console.log('✅ Datos restaurados y aplanados en la nube.');
    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
