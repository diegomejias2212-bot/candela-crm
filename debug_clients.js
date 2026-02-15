const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

// Find admin user key
const adminKey = Object.keys(data).find(k => k.startsWith('user_'));
console.log('User Key:', adminKey);

if (adminKey) {
    const userData = data[adminKey];
    console.log('Clients Type:', typeof userData.clientes);
    console.log('Clients is Array:', Array.isArray(userData.clientes));
    if (Array.isArray(userData.clientes)) {
        console.log('Clients Count:', userData.clientes.length);
        if (userData.clientes.length > 0) {
            console.log('First Client:', JSON.stringify(userData.clientes[0], null, 2));
        }
    } else {
        console.log('Clients is NOT an array!');
    }

    console.log('Sales Count:', userData.ventas ? userData.ventas.length : 0);
} else {
    console.log('No user key found!');
    console.log('Root keys:', Object.keys(data));
}
