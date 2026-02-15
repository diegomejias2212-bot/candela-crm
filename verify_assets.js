const fs = require('fs');
const http = require('http');
const path = require('path');

const localAppJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

http.get('http://localhost:5000/app.js', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Local Length:', localAppJs.length);
        console.log('Remote Length:', data.length);

        if (localAppJs === data) {
            console.log('✅ app.js matches perfectly.');
        } else {
            console.log('❌ app.js MISMATCH!');
            console.log('First 100 chars local:', localAppJs.substring(0, 100));
            console.log('First 100 chars remote:', data.substring(0, 100));
        }
    });
}).on('error', err => {
    console.error('Error fetching app.js:', err.message);
});
