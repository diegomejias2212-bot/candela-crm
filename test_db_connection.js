const { Pool } = require('pg');

const connectionString = 'postgresql://postgres:KPOJQxNxwrgXYNmzBwkultDAriiWjGag@hopper.proxy.rlwy.net:19198/railway';

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        console.log('Connecting to DB...');
        const client = await pool.connect();
        console.log('✅ Connected!');

        // List Tables
        const tables = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        `);
        console.log('Tables:', tables.rows.map(r => `${r.table_schema}.${r.table_name}`));

        // Check Row Counts
        for (const row of tables.rows) {
            const table = row.table_name;
            const count = await client.query(`SELECT COUNT(*) FROM "${table}"`);
            console.log(`- ${table}: ${count.rows[0].count} rows`);
        }

        // Check Users
        if (tables.rows.find(t => t.table_name === 'users')) {
            const users = await client.query('SELECT id, username, plan FROM users LIMIT 5');
            console.log('Users sample:', users.rows);
        }

        client.release();
    } catch (e) {
        console.error('❌ Connection failed:', e);
    } finally {
        await pool.end();
    }
}

test();
