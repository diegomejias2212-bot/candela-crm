const http = require('http');

// Log environment for debugging
console.log('--- SERVER STARTING ---');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT env var:', process.env.PORT);

const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`Candela CRM: Online on port ${port}`);
});

// Listen on all interfaces (no host argument) to avoid IPv4/6 issues
server.listen(port, () => {
    console.log(`--- SERVER LISTENING ON PORT ${port} ---`);
});

// Prevent immediate exit if something throws
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
