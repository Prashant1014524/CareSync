const publicDoctorProfile = {
  select: {
    id: true,
    userId: true,
    specialization: true,
    bio: true,
    startHour: true,
    endHour: true,
    slotDurationMinutes: true,
    consultationFee: true,
    clinicName: true,
    clinicAddress: true,
    clinicCity: true,
    clinicPostalCode: true,
  },
};

module.exports = { publicDoctorProfile };
