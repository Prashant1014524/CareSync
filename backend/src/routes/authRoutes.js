const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { registerStaff } = require('../controllers/staffInviteController');
const { applyForListing } = require('../controllers/doctorListingController');

router.post('/register', register);
router.post('/staff/register', registerStaff);
router.post('/doctor/apply', applyForListing);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/profile', authenticate, getProfile);

module.exports = router;
