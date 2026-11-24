const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { registerStaff } = require('../controllers/staffInviteController');
const { applyForListing } = require('../controllers/doctorListingController');
const { forgotPassword, resetPassword } = require('../controllers/passwordResetController');
const { rateLimit } = require('express-rate-limit');

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset attempts. Try again in 15 minutes.' },
});

router.post('/register', register);
router.post('/staff/register', registerStaff);
router.post('/doctor/apply', applyForListing);
router.post('/login', login);
router.post('/forgot-password', passwordResetLimiter, forgotPassword);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.post('/google', googleLogin);
router.get('/profile', authenticate, getProfile);

module.exports = router;
