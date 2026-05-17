const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const Resource = require('../models/Resource');

/**
 * STUB ROUTES — Resource Management
 * These are placeholders for Member 5 to implement.
 * They have correct auth + role guards already wired up.
 */

// POST /api/resources — ResourceProvider adds new inventory
router.post('/', authenticate, requireRole('ResourceProvider'), async (req, res) => {
  try {
    const { name, quantity, category } = req.body;
    const resource = new Resource({
      name,
      quantity,
      category,
      provider: req.user._id
    });
    await resource.save();
    res.status(201).json({ success: true, data: resource });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/resources — Any logged-in user can view resources
router.get('/', authenticate, async (req, res) => {
  try {
    const resources = await Resource.find().populate('provider', 'name email');
    res.json({ success: true, count: resources.length, data: resources });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/resources/:id — ResourceProvider updates inventory
router.patch('/:id', authenticate, requireRole('ResourceProvider'), async (req, res) => {
  try {
    // Only allow updating quantity or category, and only if they own it
    const resource = await Resource.findOneAndUpdate(
      { _id: req.params.id, provider: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!resource) {
      return res.status(404).json({ success: false, message: 'Resource not found or unauthorized' });
    }
    res.json({ success: true, data: resource });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
