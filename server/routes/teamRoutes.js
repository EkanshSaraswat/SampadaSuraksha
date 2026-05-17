const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');
const Report = require('../models/Report');

function attachTeamLoad(teams, activeReports) {
  return teams.map((team) => {
    const id = team._id.toString();
    const activeAssignments = activeReports.filter((r) => {
      const onTeam = (r.assignedTeams || []).some((t) => t.toString() === id);
      const claimed = r.claimedBy?.toString() === id;
      return onTeam || claimed;
    }).length;

    const approvalStatus = team.approvalStatus || 'approved';

    return {
      ...team.toObject(),
      approvalStatus,
      activeAssignments,
      isBusy: activeAssignments >= 2,
      isAvailable: activeAssignments < 2,
    };
  });
}

function normalizeMembers(members) {
  if (!Array.isArray(members)) return [];
  return members
    .map((m) => ({
      name: (m?.name || '').trim(),
      contact: (m?.contact || m?.phone || '').trim(),
      email: (m?.email || '').trim().toLowerCase(),
    }))
    .filter((m) => m.name && m.contact);
}

// POST /api/teams — NGO creates a rescue team with member roster + login credentials
router.post('/', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const { teamName, name, email, password, members } = req.body;
    const displayName = (teamName || name || '').trim();
    const loginEmail = (email || '').trim().toLowerCase();
    const roster = normalizeMembers(members);

    if (!displayName) {
      res.status(400);
      throw new Error('Please provide a team name');
    }
    if (!loginEmail) {
      res.status(400);
      throw new Error('Please provide a login email for the team');
    }
    if (!password) {
      res.status(400);
      throw new Error('Please provide a password for the team login');
    }
    if (password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }
    if (roster.length === 0) {
      res.status(400);
      throw new Error('Add at least one team member with name and contact details');
    }

    const existing = await User.findOne({ email: loginEmail });
    if (existing) {
      res.status(400);
      throw new Error('An account with this login email already exists');
    }

    const team = await User.create({
      name: displayName,
      email: loginEmail,
      password,
      role: 'RescueTeam',
      approvalStatus: 'approved',
      affiliatedNGO: req.user.id,
      city: req.user.city || '',
      state: req.user.state || '',
      teamMembers: roster,
    });

    const safe = await User.findById(team._id).select('-password');

    res.status(201).json({
      success: true,
      message: `Rescue team "${displayName}" created. Team can sign in with the login email and password.`,
      team: safe,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/teams — Admin/NGO view rescue teams with workload
// NGO: ?mine=true (default) = only teams created by this NGO
router.get('/', authenticate, requireRole('Admin', 'NGO', 'ResourceProvider'), async (req, res, next) => {
  try {
    const query = { role: 'RescueTeam' };

    if (req.user.role === 'NGO') {
      const mineOnly = req.query.mine !== 'false';
      if (mineOnly) {
        query.affiliatedNGO = req.user.id;
      }
    }

    if (req.query.includePending !== 'true') {
      query.$or = [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }];
    }

    const teams = await User.find(query).select('-password').sort({ name: 1 });

    const activeReports = await Report.find({
      status: { $nin: ['resolved'] },
    }).select('assignedTeams claimedBy');

    const teamsWithLoad = attachTeamLoad(teams, activeReports);

    res.json({
      success: true,
      count: teamsWithLoad.length,
      teams: teamsWithLoad,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
