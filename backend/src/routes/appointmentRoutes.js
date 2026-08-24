const express = require('express');
const router = express.Router();
const {
  searchDoctors,
  getSlots,
  reserveSlotHold,
  confirmBooking,
  submitPostVisitNotes,
  getPatientAppointments,
  getDoctorAppointments,
  cancelAppointment,
} = require('../controllers/appointmentController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Public search
router.get('/doctors/search', searchDoctors);
router.get('/doctors/:doctorId/slots', getSlots);

// Protected routes
router.use(authenticate);

router.post('/hold-slot', authorize('PATIENT'), reserveSlotHold);
router.post('/book', authorize('PATIENT'), confirmBooking);
router.get('/patient', authorize('PATIENT'), getPatientAppointments);

router.get('/doctor', authorize('DOCTOR', 'ADMIN'), getDoctorAppointments);
router.post('/:appointmentId/post-visit', authorize('DOCTOR', 'ADMIN'), submitPostVisitNotes);

router.post('/:appointmentId/cancel', cancelAppointment);

module.exports = router;
