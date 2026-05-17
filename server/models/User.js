const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['Victim', 'RescueTeam', 'NGO', 'Admin', 'ResourceProvider'],
    required: true
  },
  /** Rescue teams must be approved by Admin before they can claim missions */
  approvalStatus: {
    type: String,
    enum: ['approved', 'pending', 'rejected'],
    default: 'approved',
  },
  /** NGO / provider service area — used to filter assignments by location */
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  serviceRadiusKm: { type: Number, default: 50, min: 1 },
  /** Optional link from rescue team to their parent NGO */
  affiliatedNGO: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  /** Roster for NGO-created rescue teams (name, contact, email per member) */
  teamMembers: [
    {
      name: { type: String, trim: true, required: true },
      contact: { type: String, trim: true, required: true },
      email: { type: String, trim: true, lowercase: true, default: '' },
    },
  ],
}, { timestamps: true });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);