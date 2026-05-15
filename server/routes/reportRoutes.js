const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

/**
 * STUB ROUTES — Report Management
 * These are placeholders for Member 2 to implement.
 * They have correct auth + role guards already wired up.
 */

// POST /api/reports — Victim submits a disaster report with location + needs
router.post('/', authenticate, requireRole('Victim'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Report submission — Member 2 will implement',
    user: req.user,
  });
});

// GET /api/reports/nearby — Rescue teams find nearby reports ($nearSphere)
router.get('/nearby', authenticate, requireRole('RescueTeam'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Nearby reports — Member 2 will implement',
    user: req.user,
  });
});

// PATCH /api/reports/:id/claim — Rescue team claims a report (atomic update)
router.patch('/:id/claim', authenticate, requireRole('RescueTeam'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Claim report — Member 2 will implement',
    reportId: req.params.id,
    user: req.user,
  });
});

// GET /api/reports — Admin/NGO view all reports
router.get('/', authenticate, requireRole('Admin', 'NGO'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] All reports — Member 2 will implement',
    user: req.user,
  });
});

module.exports = router;
