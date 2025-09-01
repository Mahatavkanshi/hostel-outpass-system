// backend/server.js
const http = require('http');
const app = require('./app');

// Start the cron job
require('./cron/schedular');

// If you’re using raw `ws`
const { setupWebSocket } = require('./wsServer');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

// Attach WS upgrade handler
setupWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
