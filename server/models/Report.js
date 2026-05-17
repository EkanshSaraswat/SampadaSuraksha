const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema(
  {
    victim: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    urgency: {
      type: String,
      enum: ['Normal', 'Medical Emergency'],
      default: 'Normal',
    },
    disasterType: {
      type: String,
      enum: ['Earthquake', 'Flood', 'Cyclone', 'Fire', 'Landslide', 'Drought', 'Other'],
      default: 'Other',
    },
    needs: {
      type: [String],
      enum: [
        'Food',
        'Water',
        'Medicine',
        'Clothing',
        'Shelter',
        'Equipment',
        'Transport',
        'Medical',
        'Other',
      ],
      default: [],
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    status: {
      type: String,
      enum: ['pending', 'claimed', 'in-progress', 'resolved'],
      default: 'pending',
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    /** Admin assigns an NGO; the NGO then assigns rescue teams */
    assignedNGO: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedTeams: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    /** Per-team dispatch: resources + instructions from NGO for the mission */
    teamBriefings: [
      {
        team: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        instructions: { type: String, default: '', trim: true },
        resources: [
          {
            name: { type: String, required: true, trim: true },
            category: { type: String, default: 'Other' },
            quantity: { type: Number, default: 1, min: 0 },
            source: {
              type: String,
              enum: ['ngo_stock', 'provider', 'other'],
              default: 'other',
            },
            sourceLabel: { type: String, default: '', trim: true },
          },
        ],
        updatedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

reportSchema.index({ location: '2dsphere' });

reportSchema.pre('validate', function () {
  if (this.latitude != null && this.longitude != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude],
    };
  }
});

module.exports = mongoose.model('Report', reportSchema);
