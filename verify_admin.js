const http = require('http');
const fs = require('fs');

async function test() {
    console.log('--- Verifying Admin & SaaS Updates ---');

    // 1. Check Admin User in JSON
    try {
        const users = JSON.parse(fs.readFileSync('users.json', 'utf8'));
        const admin = users.find(u => u.username === 'admin');
        if (admin && admin.plan === 'pro') {
            console.log('✅ Admin is PRO');
            if (new Date(admin.plan_expires).getFullYear() > 2030) {
                console.log('✅ Admin has lifetime access');
            } else {
                console.error('❌ Admin expiration is too soon:', admin.plan_expires);
            }
        } else {
            console.error('❌ Admin not found or not PRO');
        }
    } catch (e) {
        console.error('❌ Error reading users.json:', e.message);
    }

    // 2. Login as Admin to get token
    const loginData = JSON.stringify({ username: 'admin', password: 'admin123' });
    const loginReq = http.request({
        hostname: 'localhost', port: 5000, path: '/api/login', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            if (res.statusCode === 200) {
                const token = JSON.parse(body).token;
                console.log('✅ Admin Login Successful');

                // 3. Check GET /api/admin/users
                const usersReq = http.request({
                    hostname: 'localhost', port: 5000, path: '/api/admin/users', method: 'GET',
                    headers: { 'Authorization': `Bearer ${token}` }
                }, res2 => {
                    let body2 = '';
                    res2.on('data', d => body2 += d);
                    res2.on('end', () => {
                        if (res2.statusCode === 200) {
                            const usersList = JSON.parse(body2);
                            console.log(`✅ /api/admin/users returned ${usersList.length} users`);
                            if (usersList.length > 0 && usersList[0].username) {
                                console.log('✅ User list structure correct');
                            }
                        } else {
                            console.error('❌ Failed to get users:', res2.statusCode);
                        }
                    });
                });
                usersReq.end();

            } else {
                console.error('❌ Admin Login Failed');
            }
        });
    });
    loginReq.write(loginData);
    loginReq.end();

    // 4. Check Frontend Files
    const indexHtml = fs.readFileSync('index.html', 'utf8');
    if (indexHtml.includes('id="suscriptores"')) console.log('✅ index.html has Subscribers section');
    else console.error('❌ index.html missing Subscribers section');
    if (indexHtml.includes('$13 USD')) console.log('✅ index.html has updated price');
    else console.error('❌ index.html missing updated price');

    const appJs = fs.readFileSync('app.js', 'utf8');
    if (appJs.includes('renderSubscribers')) console.log('✅ app.js has renderSubscribers');
    else console.error('❌ app.js missing renderSubscribers');
}

test();
