const fs = require('fs');

const DATA_FILE = 'data.json';
const ADMIN_ID = '1771081369399';
const TARGET_KEY = `user_${ADMIN_ID}`;

try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    // 1. Identify Root Data (Legacy)
    const rootData = {};
    Object.keys(data).forEach(key => {
        if (!key.startsWith('user_')) {
            rootData[key] = data[key];
        }
    });

    console.log(`Found ${Object.keys(rootData).length} root keys to migrate.`);

    // 2. Assign to Admin
    if (!data[TARGET_KEY]) {
        console.log('Admin key did not exist, creating new.');
    } else {
        console.log('Admin key existed, overwriting with legacy data.');
    }

    data[TARGET_KEY] = rootData;

    // 3. Save
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Migration successful. Root data copied to Admin.');

} catch (e) {
    console.error('❌ Error during migration:', e);
}
