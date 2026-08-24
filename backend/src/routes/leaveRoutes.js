const express = require('express');
const router = express.Router();
const { addLeave, deleteLeave, getDoctorLeaves } = require('../controllers/leaveController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.post('/mark', authorize('ADMIN', 'DOCTOR'), addLeave);
router.post('/remove', authorize('ADMIN', 'DOCTOR'), deleteLeave);
router.get('/doctor', authorize('ADMIN', 'DOCTOR'), getDoctorLeaves);

module.exports = router;
