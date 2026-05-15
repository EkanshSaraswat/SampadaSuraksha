/**
 * Input validation middleware for auth routes.
 * Checks that required fields are present and valid
 * before hitting the controller / database.
 */

const VALID_ROLES = ['Victim', 'RescueTeam', 'NGO', 'Admin', 'ResourceProvider'];

const validateRegister = (req, res, next) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({
      success: false,
      message: 'Please provide name, email, password, and role',
    });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters',
    });
  }

  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({
      success: false,
      message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide email and password',
    });
  }

  next();
};

module.exports = { validateRegister, validateLogin };
