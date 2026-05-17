const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, city, state, latitude, longitude } = req.body;

    if (role === 'NGO' || role === 'ResourceProvider') {
      if (!city?.trim() || !state?.trim()) {
        res.status(400);
        throw new Error('City and state are required for NGO and Resource Provider accounts');
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      res.status(400);
      throw new Error('An account with this email already exists');
    }

    const approvalStatus = role === 'RescueTeam' ? 'pending' : 'approved';

    const profile = {};
    if (city) profile.city = String(city).trim();
    if (state) profile.state = String(state).trim();
    if (latitude != null && longitude != null) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        profile.latitude = lat;
        profile.longitude = lng;
      }
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      approvalStatus,
      ...profile,
    });

    // Rescue teams cannot log in until approved — no token yet
    if (role === 'RescueTeam') {
      return res.status(201).json({
        success: true,
        pendingApproval: true,
        message:
          'Registration received. An admin must approve your rescue team account before you can sign in.',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          approvalStatus: user.approvalStatus,
        },
      });
    }

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      token,
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
};

/**
 * @desc    Login user & return JWT
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    if (user.role === 'RescueTeam') {
      if (user.approvalStatus === 'pending') {
        res.status(403);
        throw new Error(
          'Your rescue team account is awaiting admin approval. You will be able to sign in once approved.'
        );
      }
      if (user.approvalStatus === 'rejected') {
        res.status(403);
        throw new Error('Your rescue team registration was not approved. Contact the administrator.');
      }
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
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
};

/**
 * @desc    Get current logged-in user's profile
 * @route   GET /api/auth/me
 * @access  Private (any authenticated user)
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is set by the authenticate middleware (contains id, role, name)
    const user = await User.findById(req.user.id).select('-password');
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
};

module.exports = { register, login, getMe };
