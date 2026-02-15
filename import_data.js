const fs = require('fs');
const path = require('path');

const LOCAL_DATA_FILE = path.join(__dirname, 'data.json');
const CLOUD_DATA_FILE = path.join(__dirname, 'data_cloud.json');

function importData() {
    if (!fs.existsSync(CLOUD_DATA_FILE)) {
        console.error('❌ Error: No se encontró el archivo data_cloud.json');
        console.log('ℹ️  Por favor, asegúrate de haber guardado los datos de producción en este archivo.');
        return;
    }

    console.log('🔄 Leyendo archivos...');
    const localData = JSON.parse(fs.readFileSync(LOCAL_DATA_FILE, 'utf8'));
    const cloudData = JSON.parse(fs.readFileSync(CLOUD_DATA_FILE, 'utf8'));

    // Merge Lists (Ventas, Clientes, etc.)
    // Strategy: Replace local lists with cloud lists to ensure sync, 
    // but keep local config if needed. 
    // Actually, for a full restore/sync, replacing is safer to avoid duplicates unless we do ID matching.
    // Given the user wants "production data", replacing completely is likely what they want.

    console.log(`📊 Datos Local: ${localData.ventas ? localData.ventas.length : 0} ventas.`);
    console.log(`☁️  Datos Cloud: ${cloudData.ventas ? cloudData.ventas.length : 0} ventas.`);

    // Backup local just in case
    fs.writeFileSync(LOCAL_DATA_FILE + '.bak', JSON.stringify(localData, null, 2));
    console.log('💾 Respaldo local creado (data.json.bak)');

    // Assign Cloud Data to Local
    // Preserve config if missing in cloud, otherwise overwrite
    const newData = { ...localData, ...cloudData };

    // Ensure we keep specific local configs if necessary, but here we probably want full overwrite of data fields
    // Let's ensure critical sections are present
    if (!newData.ventas) newData.ventas = [];
    if (!newData.metas) newData.metas = {};

    fs.writeFileSync(LOCAL_DATA_FILE, JSON.stringify(newData, null, 2));

    console.log('✅ Importación completada exitosamente.');
    console.log('🚀 Reinicia el servidor si es necesario para ver los cambios.');
}

importData();
