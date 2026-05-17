const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const Report = require('../models/Report');
const { publishRescueEvent, getTopPriorities, removeFromQueue } = require('../services/redisService');

/**
 * STUB ROUTES — Report Management
 * These are placeholders for Member 2 to implement.
 * They have correct auth + role guards already wired up.
 */

// POST /api/reports — Victim submits a disaster report with location + needs
router.post('/', authenticate, requireRole('Victim'), async (req, res) => {
  try {
    const { longitude, latitude, needs, category } = req.body;
    
    if (longitude == null || latitude == null || !needs) {
      return res.status(400).json({ success: false, message: 'Please provide longitude, latitude, and needs' });
    }

    const report = new Report({
      victim: req.user.id,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      needs,
      category: category || 'other'
    });

    await report.save();

    // Call Member 3's Redis publish logic
    await publishRescueEvent(report);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: report
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/nearby — Rescue teams find nearby reports ($nearSphere)
router.get('/nearby', authenticate, requireRole('RescueTeam'), async (req, res) => {
  try {
    const { longitude, latitude, maxDistance = 10000 } = req.query; // maxDistance in meters, default 10km

    if (longitude == null || latitude == null) {
      return res.status(400).json({ success: false, message: 'Please provide longitude and latitude' });
    }

    const reports = await Report.find({
      status: 'Pending',
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance)
        }
      }
    }).populate('victim', 'name email');

    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/reports/:id/claim — Rescue team claims a report (atomic update)
router.patch('/:id/claim', authenticate, requireRole('RescueTeam'), async (req, res) => {
  try {
    const reportId = req.params.id;

    // Atomic update: only updates if status is 'Pending'
    const report = await Report.findOneAndUpdate(
      { _id: reportId, status: 'Pending' },
      { 
        status: 'Claimed',
        assignedTeam: req.user.id
      },
      { new: true } // Returns the modified document
    ).populate('victim', 'name email');

    if (!report) {
      return res.status(400).json({ 
        success: false, 
        message: 'Report is either already claimed, resolved, or does not exist' 
      });
    }

    // Remove from Redis priority queue so other teams don't see it
    await removeFromQueue(reportId);

    res.json({
      success: true,
      message: 'Report successfully claimed',
      data: report
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/priority — Rescue teams fetch top priority reports from Redis queue
router.get('/priority', authenticate, requireRole('RescueTeam'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    // 1. Get top report IDs from Redis sorted set
    const topItems = await getTopPriorities(limit);
    
    if (!topItems.length) {
      return res.json({ success: true, count: 0, data: [] });
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
       return res.json({ success: true, count: 0, data: [] });
    }

    // 2. Fetch full report documents from MongoDB
    // We use $in to fetch them, but MongoDB doesn't guarantee order.
    const reports = await Report.find({ _id: { $in: validReportIds } })
      .populate('victim', 'name email');

    // 3. Re-sort the reports to match the Redis priority order
    const sortedReports = topItems.map(item => {
      return reports.find(r => r._id.toString() === item.reportId);
    }).filter(Boolean); // Filter out any nulls (if a report was deleted in Mongo but still in Redis)

    res.json({
      success: true,
      count: sortedReports.length,
      data: sortedReports
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports/my — Victim views their own reports
router.get('/my', authenticate, requireRole('Victim'), async (req, res) => {
  try {
    const reports = await Report.find({ victim: req.user.id }).sort({ createdAt: -1 });
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/reports — Admin/NGO view all reports
router.get('/', authenticate, requireRole('Admin', 'NGO'), async (req, res) => {
  try {
    const reports = await Report.find()
      .populate('victim', 'name email')
      .populate('assignedTeam', 'name email');
      
    res.json({
      success: true,
      count: reports.length,
      data: reports
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
