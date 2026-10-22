const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const { errorHandler } = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/auth');
const { getMe } = require('./controllers/authController');

const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Root convenience /me route per prompt ("Register, login and GET /me")
app.get('/me', authenticate, getMe);

// API routes
app.use('/api', apiRoutes);

// Catch 404
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.originalUrl} not found`
    }
  });
});

// Centralized error handling mapper
app.use(errorHandler);

module.exports = app;
