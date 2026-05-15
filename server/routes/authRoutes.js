const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { validateRegister, validateLogin } = require('../middleware/validateRequest');
const authenticate = require('../middleware/authenticate');

// POST /api/auth/register — Create a new account
router.post('/register', validateRegister, register);

// POST /api/auth/login — Login and get JWT token
router.post('/login', validateLogin, login);

// GET /api/auth/me — Get current user profile (must be logged in)
router.get('/me', authenticate, getMe);

module.exports = router;
