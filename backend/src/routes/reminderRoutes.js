const express = require('express');
const router = express.Router();
const { getPatientReminders, toggleReminderStatus } = require('../controllers/reminderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);

router.get('/', authorize('PATIENT'), getPatientReminders);
router.patch('/:reminderId/toggle', authorize('PATIENT'), toggleReminderStatus);

module.exports = router;
