const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const Report = require('../models/Report');
const { publishRescueEvent } = require('../services/redisService');

/**
 * STUB ROUTES — Report Management
 * These are placeholders for Member 2 to implement.
 * They have correct auth + role guards already wired up.
 */

// POST /api/reports — Victim submits a disaster report with location + needs
router.post('/', authenticate, requireRole('Victim'), async (req, res) => {
  try {
    const { longitude, latitude, needs, medicalEmergency } = req.body;
    
    if (longitude == null || latitude == null || !needs) {
      return res.status(400).json({ success: false, message: 'Please provide longitude, latitude, and needs' });
    }

    const report = new Report({
      victim: req.user._id,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      needs,
      medicalEmergency: medicalEmergency || false
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
        assignedTeam: req.user._id
      },
      { new: true } // Returns the modified document
    ).populate('victim', 'name email');

    if (!report) {
      return res.status(400).json({ 
        success: false, 
        message: 'Report is either already claimed, resolved, or does not exist' 
      });
    }

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
