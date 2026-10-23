const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  requireMaintenanceRole,
  createTask,
  updateTaskStatus
} = require('../controllers/maintenanceController');

const router = express.Router();

// All maintenance operations require authentication and appropriate role (STAFF on MAINTENANCE_DUTY or ADMIN)
router.use(authenticate, requireMaintenanceRole);

// POST /api/maintenance/tasks - Create maintenance task (Contract 6.1)
router.post('/tasks', createTask);

// PUT /api/maintenance/tasks/:maintId/status - Update task status (Contract 6.2)
router.put('/tasks/:maintId/status', updateTaskStatus);

module.exports = router;
