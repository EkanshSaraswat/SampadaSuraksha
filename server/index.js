const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// --- Global Middleware ---
app.use(cors());
app.use(express.json());

// --- Health Check ---
app.get('/', (req, res) => res.json({ message: 'SampadaSuraksha API running' }));

// ── Redis Subscriber (starts listening on boot) ──
const { subscribeToRescueEvents } = require('./services/redisService');
subscribeToRescueEvents();

// --- API Routes ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/teams', require('./routes/teamRoutes'));
app.use('/api/ngos', require('./routes/ngoRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// --- 404 Handler ---
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// --- Centralized Error Handler (must be last) ---
app.use(errorHandler);

// --- Start Server ---
// Default 5001: macOS AirPlay Receiver often binds port 5000.
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT);

server.on('listening', () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Assign NGO: PATCH /api/reports/assign-ngo/:reportId');
  console.log('NGO assign team: PATCH /api/reports/assign-team/:reportId');
  console.log('NGO create team: POST /api/teams');
  console.log('NGO briefing: PATCH /api/reports/briefing/:reportId');
  console.log('Resources: GET /api/resources/mine, POST /api/resources/allocate');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Stop the other process: lsof -i :${PORT}   then   kill <PID>`);
    console.error(`Or set a different PORT in server/.env`);
  } else {
    console.error(err);
  }
  process.exit(1);
});