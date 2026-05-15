const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

/**
 * STUB ROUTES — Team Management
 * For NGO and Admin to manage rescue teams.
 */

// GET /api/teams — NGO/Admin view all rescue teams
router.get('/', authenticate, requireRole('Admin', 'NGO'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] List all teams — to be implemented',
    user: req.user,
  });
});

// GET /api/teams/:id — NGO/Admin view a specific team
router.get('/:id', authenticate, requireRole('Admin', 'NGO'), (req, res) => {
  res.json({
    success: true,
    message: '[STUB] Get team details — to be implemented',
    teamId: req.params.id,
    user: req.user,
  });
});

module.exports = router;
