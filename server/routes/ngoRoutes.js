const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const User = require('../models/User');
const Report = require('../models/Report');
const { distanceKm, locationLabel } = require('../utils/geo');

// GET /api/ngos — Admin lists NGOs with workload stats; optional lat/lng sorts by distance
router.get('/', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const reportLat = req.query.lat != null ? Number(req.query.lat) : null;
    const reportLng = req.query.lng != null ? Number(req.query.lng) : null;
    const cityFilter = (req.query.city || '').trim().toLowerCase();
    const stateFilter = (req.query.state || '').trim().toLowerCase();

    const ngos = await User.find({ role: 'NGO' }).select('-password').sort({ name: 1 });

    const activeReports = await Report.find({
      status: { $nin: ['resolved'] },
      assignedNGO: { $ne: null },
    }).select('assignedNGO assignedTeams status');

    const approvedTeams = await User.find({
      role: 'RescueTeam',
      $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
    }).select('affiliatedNGO city state');

    const enriched = ngos.map((ngo) => {
      const ngoId = ngo._id.toString();
      const activeTasks = activeReports.filter(
        (r) => r.assignedNGO?.toString() === ngoId
      ).length;

      const affiliatedTeamCount = approvedTeams.filter(
        (t) => t.affiliatedNGO?.toString() === ngoId
      ).length;

      const dist =
        reportLat != null && reportLng != null
          ? distanceKm(reportLat, reportLng, ngo.latitude, ngo.longitude)
          : null;

      return {
        ...ngo.toObject(),
        locationLabel: locationLabel(ngo),
        activeTasks,
        teamCount: affiliatedTeamCount || approvedTeams.length,
        affiliatedTeamCount,
        distanceKm: dist != null ? Math.round(dist * 10) / 10 : null,
      };
    });

    let filtered = enriched;
    if (cityFilter) {
      filtered = filtered.filter((n) => (n.city || '').toLowerCase().includes(cityFilter));
    }
    if (stateFilter) {
      filtered = filtered.filter((n) => (n.state || '').toLowerCase().includes(stateFilter));
    }

    if (reportLat != null && reportLng != null) {
      filtered.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return a.name.localeCompare(b.name);
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    }

    res.json({
      success: true,
      count: filtered.length,
      ngos: filtered,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
