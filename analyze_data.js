const fs = require('fs');

try {
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

    console.log('--- Data Analysis ---');

    // Root Data
    const rootSales = data.ventas ? data.ventas.length : 0;
    const rootClients = data.clientes ? data.clientes.length : 0;
    const rootLocal = data.ventasLocales ? data.ventasLocales.length : 0;
    console.log(`[ROOT] Sales: ${rootSales}, Clients: ${rootClients}, Local: ${rootLocal}`);

    // User Keys
    Object.keys(data).forEach(key => {
        if (key.startsWith('user_')) {
            const uData = data[key];
            const sales = uData.ventas ? uData.ventas.length : 0;
            const clients = uData.clientes ? uData.clientes.length : 0;
            const localSales = uData.ventasLocales ? uData.ventasLocales.length : 0;
            const webSales = uData.ventasWeb ? uData.ventasWeb.length : 0;

            if (sales > 0 || clients > 0 || localSales > 0 || webSales > 0) {
                console.log(`[${key}] Sales:${sales}, Clients:${clients}, Local:${localSales}, Web:${webSales}`);
            }
        }
    });

} catch (e) {
    console.error(e);
}
