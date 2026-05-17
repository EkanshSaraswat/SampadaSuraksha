const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const Report = require('../models/Report');
const User = require('../models/User');
const { syncReportStatus } = require('../utils/reportStatus');
const { publishRescueEvent, getTopPriorities, removeFromQueue } = require('../services/redisService');
const {
  upsertTeamBriefing,
  removeTeamBriefing,
} = require('../utils/teamBriefing');

const populateReport = [
  { path: 'victim', select: 'name email' },
  { path: 'claimedBy', select: 'name email role' },
  { path: 'assignedNGO', select: 'name email city state' },
  { path: 'assignedTeams', select: 'name email role' },
  { path: 'teamBriefings.team', select: 'name email' },
];

const DISASTER_TYPES = ['Earthquake', 'Flood', 'Cyclone', 'Fire', 'Landslide', 'Drought', 'Other'];

function assertNgoOwnsReport(report, userId) {
  if (!report.assignedNGO || report.assignedNGO.toString() !== userId.toString()) {
    const err = new Error('This report is not assigned to your NGO');
    err.statusCode = 403;
    throw err;
  }
}

function assertNgoOwnsTeam(team, ngoId) {
  if (!team.affiliatedNGO || team.affiliatedNGO.toString() !== ngoId.toString()) {
    const err = new Error('You can only assign rescue teams created by your NGO');
    err.statusCode = 403;
    throw err;
  }
}

// POST /api/reports — Victim submits a disaster report
router.post('/', authenticate, requireRole('Victim'), async (req, res, next) => {
  try {
    const { description, urgency, latitude, longitude, needs, disasterType } = req.body;

    if (!description?.trim()) {
      res.status(400);
      throw new Error('Please provide a description');
    }

    const validNeeds = Array.isArray(needs)
      ? [...new Set(needs.filter(Boolean))]
      : [];
    if (validNeeds.length === 0) {
      res.status(400);
      throw new Error('Please select at least one type of help needed');
    }

    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.status(400);
      throw new Error('Valid location is required. Enable location access and try again.');
    }

    const type = DISASTER_TYPES.includes(disasterType) ? disasterType : 'Other';

    const report = await Report.create({
      victim: req.user.id,
      description: description.trim(),
      urgency: urgency || 'Normal',
      disasterType: type,
      needs: validNeeds,
      latitude: lat,
      longitude: lng,
      assignedTeams: [],
    });

    await publishRescueEvent(report);

    const populated = await Report.findById(report._id).populate(populateReport);

    res.status(201).json({
      success: true,
      report: populated,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/mine — Victim views own reports
router.get('/mine', authenticate, requireRole('Victim'), async (req, res, next) => {
  try {
    const reports = await Report.find({ victim: req.user.id })
      .populate(populateReport)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/assigned — NGO: tasks assigned by admin
router.get('/assigned', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const reports = await Report.find({ assignedNGO: req.user.id })
      .populate(populateReport)
      .sort({ urgency: -1, createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/pending — Rescue teams: NGO-dispatched missions
router.get('/pending', authenticate, requireRole('RescueTeam'), async (req, res, next) => {
  try {
    const teamId = req.user.id;
    const reports = await Report.find({
      status: { $ne: 'resolved' },
      assignedNGO: { $ne: null },
      $or: [
        { assignedTeams: teamId },
        { claimedBy: teamId },
      ],
    })
      .populate(populateReport)
      .sort({ urgency: -1, createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/priority — Rescue teams fetch top priority reports from Redis queue
router.get('/priority', authenticate, requireRole('RescueTeam'), async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 1. Get top report IDs from Redis sorted set
    const topItems = await getTopPriorities(limit);
    
    if (!topItems.length) {
      return res.json({ success: true, count: 0, reports: [] });
    }

    // Filter valid MongoDB ObjectIds and remove invalid ones from Redis
    const validReportIds = [];
    for (const item of topItems) {
      if (mongoose.Types.ObjectId.isValid(item.reportId)) {
        validReportIds.push(item.reportId);
      } else {
        console.warn(`[Redis Queue] Invalid ObjectId found: ${item.reportId}. Removing from queue.`);
        await removeFromQueue(item.reportId);
      }
    }

    if (!validReportIds.length) {
       return res.json({ success: true, count: 0, reports: [] });
    }

    // 2. Fetch full report documents from MongoDB
    const reports = await Report.find({ _id: { $in: validReportIds } })
      .populate(populateReport);

    // 3. Re-sort the reports to match the Redis priority order
    const sortedReports = topItems.map(item => {
      return reports.find(r => r._id.toString() === item.reportId);
    }).filter(Boolean);

    res.json({
      success: true,
      count: sortedReports.length,
      reports: sortedReports
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports — Admin: all reports
router.get('/', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const reports = await Report.find()
      .populate(populateReport)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/assign-ngo/:reportId — Admin assigns NGO to a report
router.patch('/assign-ngo/:reportId', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const { ngoId } = req.body;
    if (!ngoId) {
      res.status(400);
      throw new Error('ngoId is required');
    }

    const ngo = await User.findOne({ _id: ngoId, role: 'NGO' });
    if (!ngo) {
      res.status(404);
      throw new Error('NGO not found');
    }

    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    const changingNgo =
      report.assignedNGO && report.assignedNGO.toString() !== ngoId.toString();

    report.assignedNGO = ngoId;
    if (changingNgo) {
      report.assignedTeams = [];
      report.claimedBy = null;
      report.status = 'pending';
    }

    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/unassign-ngo/:reportId — Admin removes NGO from report
router.patch('/unassign-ngo/:reportId', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    report.assignedNGO = null;
    report.assignedTeams = [];
    report.claimedBy = null;
    report.status = 'pending';

    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/briefing/:reportId — NGO updates resource dispatch for an assigned team
router.patch('/briefing/:reportId', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const { teamId, instructions, resources } = req.body;
    if (!teamId) {
      res.status(400);
      throw new Error('teamId is required');
    }

    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    assertNgoOwnsReport(report, req.user.id);

    const teamIdStr = teamId.toString();
    const isAssigned = (report.assignedTeams || []).some((id) => id.toString() === teamIdStr);
    if (!isAssigned) {
      res.status(400);
      throw new Error('Team must be assigned to this mission before updating the briefing');
    }

    upsertTeamBriefing(report, teamId, { instructions, resources });
    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
});

// PATCH /api/reports/assign-team/:reportId — NGO assigns rescue team + resource briefing
router.patch('/assign-team/:reportId', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const { teamId, instructions, resources } = req.body;
    if (!teamId) {
      res.status(400);
      throw new Error('teamId is required');
    }

    const team = await User.findOne({ _id: teamId, role: 'RescueTeam' });
    if (!team) {
      res.status(404);
      throw new Error('Rescue team not found');
    }
    const approval = team.approvalStatus || 'approved';
    if (approval !== 'approved') {
      res.status(400);
      throw new Error('Only approved rescue teams can be assigned');
    }

    assertNgoOwnsTeam(team, req.user.id);

    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    assertNgoOwnsReport(report, req.user.id);

    const teamIdStr = teamId.toString();
    const alreadyAssigned = (report.assignedTeams || []).some(
      (id) => id.toString() === teamIdStr
    );

    if (!alreadyAssigned) {
      report.assignedTeams = report.assignedTeams || [];
      report.assignedTeams.push(teamId);
    }

    upsertTeamBriefing(report, teamId, { instructions, resources });
    syncReportStatus(report);
    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
});

// PATCH /api/reports/unassign-team/:reportId — NGO removes team from report
router.patch('/unassign-team/:reportId', authenticate, requireRole('NGO'), async (req, res, next) => {
  try {
    const { teamId } = req.body;
    if (!teamId) {
      res.status(400);
      throw new Error('teamId is required');
    }

    const report = await Report.findById(req.params.reportId);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    assertNgoOwnsReport(report, req.user.id);

    const teamIdStr = teamId.toString();
    report.assignedTeams = (report.assignedTeams || []).filter(
      (id) => id.toString() !== teamIdStr
    );

    removeTeamBriefing(report, teamId);
    syncReportStatus(report);
    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
});

// PATCH /api/reports/:id/claim — Rescue team accepts assigned mission
router.patch('/:id/claim', authenticate, requireRole('RescueTeam'), async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report || report.status === 'resolved') {
      return res.status(409).json({
        success: false,
        message: 'Report is no longer available to claim',
      });
    }

    if (!report.assignedNGO) {
      return res.status(409).json({
        success: false,
        message: 'This report has not been assigned to an NGO yet',
      });
    }

    const teamId = req.user.id;
    const teamIdStr = teamId.toString();
    const alreadyOnTeam = (report.assignedTeams || []).some(
      (id) => id.toString() === teamIdStr
    );

    if (!alreadyOnTeam) {
      return res.status(403).json({
        success: false,
        message: 'Your team must be assigned by the coordinating NGO before you can claim this mission',
      });
    }

    if (report.claimedBy && report.claimedBy.toString() !== teamIdStr) {
      return res.status(409).json({
        success: false,
        message: 'Report is already claimed by another team',
      });
    }

    syncReportStatus(report);
    report.claimedBy = report.claimedBy || teamId;

    await report.save();

    // Remove from Redis priority queue so other teams don't see it
    await removeFromQueue(report._id.toString());

    const populated = await Report.findById(report._id).populate(populateReport);

    res.json({
      success: true,
      report: populated,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/reports/:id/status — Admin / NGO update report status
router.patch('/:id/status', authenticate, requireRole('Admin', 'NGO'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'claimed', 'in-progress', 'resolved'];
    if (!allowed.includes(status)) {
      res.status(400);
      throw new Error(`Status must be one of: ${allowed.join(', ')}`);
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    if (req.user.role === 'NGO') {
      assertNgoOwnsReport(report, req.user.id);
    }

    report.status = status;
    if (status === 'pending') {
      report.claimedBy = null;
      report.assignedTeams = [];
      report.teamBriefings = [];
    } else if (status !== 'resolved') {
      syncReportStatus(report);
    }
    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);

    res.json({
      success: true,
      report: populated,
    });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
});

// PATCH /api/reports/:id/progress — Assigned rescue team updates mission status
router.patch('/:id/progress', authenticate, requireRole('RescueTeam'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['in-progress', 'resolved'];
    if (!allowed.includes(status)) {
      res.status(400);
      throw new Error(`Status must be one of: ${allowed.join(', ')}`);
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    const teamIdStr = req.user.id.toString();
    const isAssigned = (report.assignedTeams || []).some(
      (id) => id.toString() === teamIdStr
    );
    if (!isAssigned && report.claimedBy?.toString() !== teamIdStr) {
      res.status(403);
      throw new Error('You are not assigned to this report');
    }

    report.status = status;
    await report.save();

    const populated = await Report.findById(report._id).populate(populateReport);
    res.json({ success: true, report: populated });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id — Admin removes a report
router.delete('/:id', authenticate, requireRole('Admin'), async (req, res, next) => {
  try {
    const report = await Report.findByIdAndDelete(req.params.id);
    if (!report) {
      res.status(404);
      throw new Error('Report not found');
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
