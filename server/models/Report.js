const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  victim: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true
    },
    coordinates: {
      type: [Number],
      required: true // [longitude, latitude]
    }
  },
  needs: {
    type: String,
    required: true
  },
  medicalEmergency: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Claimed', 'Resolved'],
    default: 'Pending'
  },
  assignedTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Create 2dsphere index for location for geospatial queries
reportSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Report', reportSchema);
