const express = require('express');
const router = express.Router();
const { createDoctor, updateDoctor, getAllDoctors, getAdminStats } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/doctors', createDoctor);
router.put('/doctors/:doctorId', updateDoctor);
router.get('/doctors', getAllDoctors);
router.get('/stats', getAdminStats);

module.exports = router;
