const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { registerStaff } = require('../controllers/staffInviteController');

router.post('/register', register);
router.post('/staff/register', registerStaff);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/profile', authenticate, getProfile);

module.exports = router;
