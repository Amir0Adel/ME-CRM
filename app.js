// cPanel / Phusion Passenger entry point.
// Loads dotenv (if present) then boots the actual server.
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }
require('./server/index.js');
