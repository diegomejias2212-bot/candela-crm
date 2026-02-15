const https = require('https');
const fs = require('fs');

const BASE_URL = 'https://candela-crm-production.up.railway.app';
const CREDENTIALS = { username: 'admin', password: 'admin123' }; // Trying default/known

function request(method, path, data = null, token = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            }
        };
        if (token) options.headers['Authorization'] = `Bearer ${token}`;

        const req = https.request(url, options, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function recover() {
    console.log(`Connecting to ${BASE_URL}...`);

    // 1. Try Login
    try {
        const loginRes = await request('POST', '/api/login', CREDENTIALS);
        if (loginRes.status === 200) {
            const token = JSON.parse(loginRes.body).token;
            console.log('✅ Login Successful!');

            // 2. Fetch Data
            const dataRes = await request('GET', '/api/data', null, token);
            if (dataRes.status === 200) {
                fs.writeFileSync('data_cloud.json', dataRes.body);
                console.log('✅ Remote data saved to data_cloud.json');

                // Compare counts
                const data = JSON.parse(dataRes.body);
                console.log(`Remote contains: ${data.ventas ? data.ventas.length : 0} sales, ${data.clientes ? data.clientes.length : 0} clients.`);
            } else {
                console.error('❌ Failed to fetch data:', dataRes.status);
            }
        } else {
            console.error('❌ Login failed with default credentials:', loginRes.status);
            console.log('User needs to provide credentials or use browser method.');
        }
    } catch (e) {
        console.error('❌ Network error:', e.message);
    }
}

recover();
