const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');

/**
 * STUB ROUTES — Team Management
 * For NGO and Admin to manage rescue teams.
 */

router.get('/', authenticate, requireRole('Admin', 'NGO'), async (req, res) => {
  try {
    const teams = await User.find({ role: 'RescueTeam' }).select('-password');
    res.json({ success: true, count: teams.length, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:id', authenticate, requireRole('Admin', 'NGO'), async (req, res) => {
  try {
    const team = await User.findOne({ _id: req.params.id, role: 'RescueTeam' }).select('-password');
    if (!team) return res.status(404).json({ success: false, message: 'Rescue team not found' });
    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
