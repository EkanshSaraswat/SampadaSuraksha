const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');

// GET /api/users/pending-approvals — Admin: rescue teams awaiting approval
router.get('/pending-approvals', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const pending = await User.find({
      role: 'RescueTeam',
      approvalStatus: 'pending',
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: pending.length,
      users: pending,
    });
  } catch (err) {
    next(err);
  }
});

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

// PATCH /api/users/:id/approve — Admin approves rescue team
router.patch('/:id/approve', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    if (user.role !== 'RescueTeam') {
      res.status(400);
      throw new Error('Only rescue team accounts require approval');
    }

    user.approvalStatus = 'approved';
    await user.save();

    res.json({
      success: true,
      message: 'Rescue team approved. They can now sign in and accept missions.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/reject — Admin rejects rescue team registration
router.patch('/:id/reject', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }
    if (user.role !== 'RescueTeam') {
      res.status(400);
      throw new Error('Only rescue team accounts require approval');
    }

    user.approvalStatus = 'rejected';
    await user.save();

    res.json({
      success: true,
      message: 'Rescue team registration rejected.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        approvalStatus: user.approvalStatus,
      },
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
