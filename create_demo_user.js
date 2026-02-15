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
    console.log('👷 Creando Usuario Demo y Verificando Aislamiento...');

    try {
        // 1. Login Admin
        console.log('🔑 Logueando como Admin...');
        const adminAuth = await request('/api/login', 'POST', { username: 'admin', password: 'admin123' });
        console.log('✅ Admin Token recibido.');

        // 2. Create Demo User
        console.log('🆕 Creando usuario "demo"...');
        try {
            const newUser = await request('/api/register', 'POST', {
                username: 'demo',
                password: 'demo123',
                plan: 'free'
            }, adminAuth.token);
            console.log('✅ Usuario Demo creado:', newUser);
        } catch (e) {
            if (e.message.includes('400')) console.log('⚠️ El usuario "demo" ya existía (OK).');
            else throw e;
        }

        // 3. Login Demo
        console.log('👤 Logueando como Demo...');
        const demoAuth = await request('/api/login', 'POST', { username: 'demo', password: 'demo123' });
        console.log('✅ Demo Token recibido. ID:', demoAuth.user.id);

        // 4. Check Data Isolation
        console.log('📦 Consultando datos de Demo...');
        const demoData = await request('/api/data', 'GET', null, demoAuth.token);

        const keys = Object.keys(demoData);
        console.log('📊 Datos de Demo:', keys);

        if (keys.length === 0 || (keys.length === 1 && keys[0] === 'config')) {
            console.log('✅ ÉXITO: El usuario Demo tiene un dashboard limpio.');
        } else if (demoData.ventas && demoData.ventas.length > 0) {
            console.error('❌ PELIGRO: El usuario Demo ve ventas existentes! FALLO DE AISLAMIENTO.');
            console.log('Ventas:', demoData.ventas.length);
        } else {
            console.log('ℹ️ El usuario Demo tiene datos vacíos (Array length 0). Aislamiento correcto.');
        }

    } catch (e) {
        console.error('❌ Error:', e.message);
    }
}

run();
