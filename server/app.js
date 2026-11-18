const express = require('express');
const cors = require('cors');
const errorHandler = require('./src/middleware/errorHandler');
const authRoutes = require('./src/routes/auth.routes');
const complaintRoutes = require('./src/routes/complaint.routes');
const noticeRoutes = require('./src/routes/notice.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const aiRoutes = require('./src/routes/ai.routes');
const userRoutes = require('./src/routes/user.routes');

const app = express();

// ─── Core Middleware ───────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));

// Limit request body size to reduce abuse surface
app.use(express.json({ limit: '50kb' }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SocietyCare API is running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/events', require('./src/routes/event.routes'));
app.use('/api/assets', require('./src/routes/asset.routes'));
app.use('/api/community', require('./src/routes/community.routes'));
app.use('/api/society', require('./src/routes/society.routes'));
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler (must be last) ─────────────────────────────────────────────

app.use(errorHandler);

module.exports = app;
