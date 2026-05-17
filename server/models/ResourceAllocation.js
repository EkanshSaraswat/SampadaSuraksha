const mongoose = require('mongoose');

const resourceAllocationSchema = new mongoose.Schema(
  {
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Resource',
      required: true,
    },
    rescueTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    allocatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: ['allocated', 'delivered', 'cancelled'],
      default: 'allocated',
    },
    notes: { type: String, trim: true, default: '' },
    report: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Report',
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResourceAllocation', resourceAllocationSchema);
