const prisma = require('../prisma');

function parseClinic(body) {
  const text = (field, max) => typeof body[field] === 'string' ? body[field].trim() : '';
  const clinic = {
    name: text('name', 150),
    address: text('address', 300),
    city: text('city', 100),
    postalCode: text('postalCode', 20),
    timeZone: typeof body.timeZone === 'string' && body.timeZone.trim() ? body.timeZone.trim() : 'Asia/Kolkata',
  };
  if (!clinic.name || clinic.name.length > 150 || !clinic.address || clinic.address.length > 300 ||
      !clinic.city || clinic.city.length > 100 || !clinic.postalCode || clinic.postalCode.length > 20) {
    return { error: 'Enter the clinic name, address, city, and PIN code within the field limits.' };
  }

  const latitude = body.latitude == null || body.latitude === '' ? null : Number(body.latitude);
  const longitude = body.longitude == null || body.longitude === '' ? null : Number(body.longitude);
  if ((latitude === null) !== (longitude === null) ||
      (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
    return { error: 'Enter a valid latitude and longitude pair or leave both blank.' };
  }
  try { new Intl.DateTimeFormat('en-US', { timeZone: clinic.timeZone }).format(new Date()); }
  catch { return { error: 'Enter a valid clinic time zone, such as Asia/Kolkata.' }; }
  const { startHour, endHour } = body;
  if (typeof startHour !== 'string' || typeof endHour !== 'string' ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(startHour) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(endHour) || startHour >= endHour) {
    return { error: 'Enter valid clinic hours with the end time after the start time.' };
  }
  const slotDurationMinutes = Number(body.slotDurationMinutes);
  const consultationFee = Number(body.consultationFee);
  const weekdays = Array.isArray(body.weekdays) ? [...new Set(body.weekdays.map(Number))] : [];
  if (!Number.isInteger(slotDurationMinutes) || slotDurationMinutes < 5 || slotDurationMinutes > 240 ||
      !Number.isFinite(consultationFee) || consultationFee < 1 || consultationFee > 21474836.47 ||
      weekdays.length === 0 || weekdays.some(day => !Number.isInteger(day) || day < 1 || day > 7)) {
    return { error: 'Choose valid working days, appointment length, and consultation fee.' };
  }
  return {
    clinic: { ...clinic, latitude, longitude },
    schedule: { startHour, endHour, slotDurationMinutes, consultationFee: Math.round(consultationFee * 100) / 100, weekdays },
  };
}

async function getDoctorClinics(req, res, next) {
  try {
    const clinics = await prisma.doctorClinic.findMany({
      where: { doctorId: req.user.id },
      include: { clinic: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ clinics });
  } catch (error) {
    next(error);
  }
}

async function createDoctorClinic(req, res, next) {
  const parsed = parseClinic(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const assignment = await prisma.$transaction(async tx => {
      const clinic = await tx.clinic.create({ data: parsed.clinic });
      return tx.doctorClinic.create({
        data: { doctorId: req.user.id, clinicId: clinic.id, ...parsed.schedule },
        include: { clinic: true },
      });
    });
    res.status(201).json({ clinic: assignment });
  } catch (error) {
    next(error);
  }
}

async function updateDoctorClinic(req, res, next) {
  const parsed = parseClinic(req.body || {});
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const assignment = await prisma.doctorClinic.findUnique({
      where: { doctorId_clinicId: { doctorId: req.user.id, clinicId: req.params.clinicId } },
      select: { clinicId: true },
    });
    if (!assignment) return res.status(404).json({ error: 'Clinic not found for this doctor.' });
    const updated = await prisma.$transaction(async tx => {
      await tx.clinic.update({ where: { id: assignment.clinicId }, data: parsed.clinic });
      return tx.doctorClinic.update({
        where: { doctorId_clinicId: { doctorId: req.user.id, clinicId: assignment.clinicId } },
        data: parsed.schedule,
        include: { clinic: true },
      });
    });
    res.json({ clinic: updated });
  } catch (error) {
    next(error);
  }
}

module.exports = { getDoctorClinics, createDoctorClinic, updateDoctorClinic };
