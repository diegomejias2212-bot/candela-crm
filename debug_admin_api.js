const http = require('http');

const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
console.log('Logging in as admin...');

const loginReq = http.request({
    hostname: 'localhost', port: 5000, path: '/api/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
}, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const token = JSON.parse(body).token;
            console.log('Login successful. Token:', token.substring(0, 10) + '...');

            // Fetch Data
            const dataReq = http.request({
                hostname: 'localhost', port: 5000, path: '/api/data', method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            }, res2 => {
                let body2 = '';
                res2.on('data', d => body2 += d);
                res2.on('end', () => {
                    console.log('Data fetch status:', res2.statusCode);
                    try {
                        const json = JSON.parse(body2);
                        const keys = Object.keys(json);
                        console.log('Data keys:', keys);
                        if (json.ventas) console.log('Ventas count:', json.ventas.length);
                        if (json.clientes) console.log('Clientes count:', json.clientes.length);
                    } catch (e) {
                        console.log('Error parsing data:', e);
                        console.log('Raw body:', body2.substring(0, 200));
                    }
                });
            });
            dataReq.end();

        } else {
            console.log('Login failed:', res.statusCode, body);
        }
    });
});
loginReq.write(loginData);
loginReq.end();
