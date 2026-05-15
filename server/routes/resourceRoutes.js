const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

/**
 * STUB ROUTES — Resource Management
 * These are placeholders for Member 5 to implement.
 * They have correct auth + role guards already wired up.
 */

// POST /api/resources — ResourceProvider adds new inventory
router.post('/', authenticate, requireRole('ResourceProvider'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Add resource — Member 5 will implement',
    user: req.user,
  });
});

// GET /api/resources — Any logged-in user can view resources
router.get('/', authenticate, (req, res) => {
  res.json({
    success: true,
    message: '[STUB] List resources — Member 5 will implement',
    user: req.user,
  });
});

// PATCH /api/resources/:id — ResourceProvider updates inventory
router.patch('/:id', authenticate, requireRole('ResourceProvider'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Update resource — Member 5 will implement',
    resourceId: req.params.id,
    user: req.user,
  });
});

module.exports = router;
