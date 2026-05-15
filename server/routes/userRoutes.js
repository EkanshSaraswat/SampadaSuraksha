const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');

/**
 * User Management Routes — Admin only.
 * These are fully implemented (not stubs) since they're part of Member 1's work.
 */

// GET /api/users — Admin gets list of all users
router.get('/', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id — Admin gets a specific user
router.get('/:id', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    res.json({
      success: true,
      user,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id — Admin deletes a user
router.delete('/:id', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Prevent admin from deleting themselves
    if (user._id.toString() === req.user.id) {
      res.status(400);
      throw new Error('You cannot delete your own account');
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
