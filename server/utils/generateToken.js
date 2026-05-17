const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token for a user.
 * Payload includes user id, role, and name so that
 * the authenticate middleware can attach them to req.user
 * without a DB lookup on every request.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      approvalStatus: user.approvalStatus || 'approved',
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
