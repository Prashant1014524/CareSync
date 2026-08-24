const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/doctorController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize('DOCTOR'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
