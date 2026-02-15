const fs = require('fs');

const DATA_FILE = 'data.json';
const ADMIN_ID = '1771081369399';
const TARGET_KEY = `user_${ADMIN_ID}`;

try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    const adminData = data[TARGET_KEY];

    if (adminData && adminData.ventas && adminData.ventas.length > 0) {
        console.log(`✅ Admin has ${adminData.ventas.length} sales.`);
        console.log(`✅ Admin has ${adminData.clientes.length} clients.`);
    } else {
        console.error('❌ Admin data is empty or missing.');
    }

} catch (e) {
    console.error('❌ Error reading file:', e);
}
