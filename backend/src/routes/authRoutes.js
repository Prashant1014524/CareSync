const express = require('express');
const router = express.Router();
const { register, login, googleLogin, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/profile', authenticate, getProfile);

module.exports = router;
