const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

function migrate() {
    if (!fs.existsSync(DATA_FILE) || !fs.existsSync(USERS_FILE)) {
        console.error('❌ Archivos no encontrados');
        return;
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    const admin = users.find(u => u.username === 'admin');

    if (!admin) {
        console.error('❌ Usuario admin no encontrado');
        return;
    }

    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);

    // Check if data is already migrated (has user keys) or is flat
    // If "ventas" exists at root, it's flat.
    if (data.ventas || data.config) {
        console.log('⚠️  Detectada estructura plana. Migrando a usuario admin...');

        const adminKey = `user_${admin.id}`;

        // Create new structure
        const newData = {
            [adminKey]: data
        };

        // Backup
        fs.writeFileSync(DATA_FILE + '.flat.bak', rawData);
        console.log('💾 Backup creado: data.json.flat.bak');

        // Save new structure
        fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2));
        console.log(`✅ Datos movidos a la clave: ${adminKey}`);

    } else {
        console.log('ℹ️  La estructura parece ya ser multi-usuario (o está vacía).');
        // Check if admin has data
        const adminKey = `user_${admin.id}`;
        if (data[adminKey]) {
            console.log(`✅ El usuario admin (${adminKey}) ya tiene datos.`);
            console.log(`   Ventas: ${data[adminKey].ventas ? data[adminKey].ventas.length : 0}`);
        } else {
            console.log(`⚠️  El usuario admin (${adminKey}) NO tiene datos.`);
        }
    }
}

migrate();
