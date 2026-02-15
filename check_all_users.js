const https = require('https');

const REMOTE_URL = 'https://web-production-8f0c.up.railway.app';

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
    console.log('🕵️‍♂️ Auditando Usuarios en Base de Datos...');

    try {
        // 1. Login Admin
        console.log('🔑 Logueando como Admin...');
        const adminAuth = await request('/api/login', 'POST', { username: 'admin', password: 'admin123' });
        console.log('✅ Admin Token recibido.');

        // 2. Get Users
        console.log('📋 Solicitando lista de usuarios...');
        const users = await request('/api/users', 'GET', null, adminAuth.token);

        console.log('\n--- USUARIOS REGISTRADOS ---');
        console.table(users.map(u => ({ id: u.id, username: u.username, plan: u.plan })));
        console.log('----------------------------');

        console.log(`Total usuarios encontrados: ${users.length}`);

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
