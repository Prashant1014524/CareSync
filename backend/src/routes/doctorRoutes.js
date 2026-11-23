const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/doctorController');
const { getDoctorClinics, createDoctorClinic, updateDoctorClinic } = require('../controllers/clinicController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.use(authenticate);
router.use(authorize('DOCTOR'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/clinics', getDoctorClinics);
router.post('/clinics', createDoctorClinic);
router.put('/clinics/:clinicId', updateDoctorClinic);

module.exports = router;
