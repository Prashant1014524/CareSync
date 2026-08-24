const bcrypt = require('bcryptjs');
const prisma = require('./prisma');

async function seed() {
  console.log('[Database Seed] Starting comprehensive database population...');

  // Clear existing records in correct relation order
  await prisma.medicationReminder.deleteMany();
  await prisma.postVisitNote.deleteMany();
  await prisma.symptomForm.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.slotHold.deleteMany();
  await prisma.doctorLeave.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.user.deleteMany();

  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashDoc = await bcrypt.hash('doc123', 10);
  const passwordHashPatient = await bcrypt.hash('patient123', 10);

  // 1. Create Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@clinic.com',
      passwordHash: passwordHashAdmin,
      name: 'Dr. Marcus Vance (Admin)',
      phone: '+1 (555) 019-2831',
      role: 'ADMIN',
    },
  });

  // 2. Create Doctors
  const docCardio = await prisma.user.create({
    data: {
      email: 'dr.smith@clinic.com',
      passwordHash: passwordHashDoc,
      name: 'Dr. Robert Smith',
      phone: '+1 (555) 012-3456',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Cardiology',
          bio: 'Chief of Cardiovascular Health with 18+ years of clinical excellence in preventative cardiology, hypertension, and arrhythmia care.',
          startHour: '08:30',
          endHour: '16:30',
          slotDurationMinutes: 30,
          consultationFee: 140.0,
        },
      },
    },
    include: { doctorProfile: true },
  });

  const docNeuro = await prisma.user.create({
    data: {
      email: 'dr.sarah@clinic.com',
      passwordHash: passwordHashDoc,
      name: 'Dr. Sarah Connor',
      phone: '+1 (555) 098-7654',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Neurology',
          bio: 'Board-certified Neurologist specializing in chronic migraine treatment, neuropathic pain, and cognitive health management.',
          startHour: '09:00',
          endHour: '17:00',
          slotDurationMinutes: 45,
          consultationFee: 160.0,
        },
      },
    },
    include: { doctorProfile: true },
  });

  const docPeds = await prisma.user.create({
    data: {
      email: 'dr.johnson@clinic.com',
      passwordHash: passwordHashDoc,
      name: 'Dr. Emily Johnson',
      phone: '+1 (555) 043-2109',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Pediatrics',
          bio: 'Compassionate pediatric specialist focusing on childhood development, immunization schedules, and adolescent health.',
          startHour: '08:00',
          endHour: '15:00',
          slotDurationMinutes: 30,
          consultationFee: 95.0,
        },
      },
    },
    include: { doctorProfile: true },
  });

  const docDerm = await prisma.user.create({
    data: {
      email: 'dr.chen@clinic.com',
      passwordHash: passwordHashDoc,
      name: 'Dr. David Chen',
      phone: '+1 (555) 067-8901',
      role: 'DOCTOR',
      doctorProfile: {
        create: {
          specialization: 'Dermatology',
          bio: 'Expert dermatologist dedicated to skin health, acne therapeutics, psoriasis management, and preventative screenings.',
          startHour: '10:00',
          endHour: '18:00',
          slotDurationMinutes: 30,
          consultationFee: 130.0,
        },
      },
    },
    include: { doctorProfile: true },
  });

  // 3. Create Patients
  const patient1 = await prisma.user.create({
    data: {
      email: 'patient1@example.com',
      passwordHash: passwordHashPatient,
      name: 'John Doe',
      phone: '+1 (555) 011-2233',
      role: 'PATIENT',
    },
  });

  const patient2 = await prisma.user.create({
    data: {
      email: 'patient2@example.com',
      passwordHash: passwordHashPatient,
      name: 'Jane Miller',
      phone: '+1 (555) 044-5566',
      role: 'PATIENT',
    },
  });

  // 4. Create Sample Appointments & AI Summaries
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const slotEndTime = new Date(tomorrow);
  slotEndTime.setMinutes(slotEndTime.getMinutes() + 30);

  // Appointment 1: High Urgency Cardiology Visit
  const app1 = await prisma.appointment.create({
    data: {
      doctorId: docCardio.id,
      patientId: patient1.id,
      startTime: tomorrow,
      endTime: slotEndTime,
      status: 'BOOKED',
      googleMeetLink: 'https://meet.google.com/cardio-urgency-visit',
      symptomForm: {
        create: {
          symptoms: 'Experiencing recurrent chest tightness upon moderate physical exertion, accompanied by subtle radiating discomfort into left shoulder.',
          duration: '4 days',
          severity: 'Severe',
          medicalHistory: 'Stage 1 Hypertension, Elevated Cholesterol',
          urgencyLevel: 'High',
          chiefComplaint: 'Exertional chest tightness with left shoulder radiation in hypertensive patient.',
          suggestedQuestions: JSON.stringify([
            'Does the chest tightness resolve completely within 5 minutes of resting?',
            'Have you experienced diaphoresis, nausea, or lightheadedness during these episodes?',
            'Are you currently adhering strictly to your anti-hypertensive medication regimen?',
          ]),
          rawLlmResponse: 'Seed pre-visit LLM response for high urgency cardiology visit.',
        },
      },
    },
  });

  // Appointment 2: Completed Neurology Visit with Post-Visit Summary & Medication Schedule
  const pastDate = new Date(today);
  pastDate.setDate(pastDate.getDate() - 2);
  pastDate.setHours(14, 0, 0, 0);

  const pastEndTime = new Date(pastDate);
  pastEndTime.setMinutes(pastEndTime.getMinutes() + 45);

  const app2 = await prisma.appointment.create({
    data: {
      doctorId: docNeuro.id,
      patientId: patient2.id,
      startTime: pastDate,
      endTime: pastEndTime,
      status: 'COMPLETED',
      googleMeetLink: 'https://meet.google.com/neuro-followup-visit',
      symptomForm: {
        create: {
          symptoms: 'Frequent unilateral throbbing headaches with photophobia and mild nausea.',
          duration: '2 weeks',
          severity: 'Moderate',
          medicalHistory: 'Occasional migraines',
          urgencyLevel: 'Medium',
          chiefComplaint: 'Recurrent unilateral headache with photophobia.',
          suggestedQuestions: JSON.stringify([
            'What specific visual or sensory aura symptoms precede the headache onset?',
            'How many days per week are your normal daily activities disrupted by headaches?',
            'What rescue medications have provided partial relief in past episodes?',
          ]),
          rawLlmResponse: 'Seed pre-visit LLM response for neurology headache visit.',
        },
      },
      postVisitNote: {
        create: {
          clinicalNotes: 'Patient evaluated for episodic migraine without aura. Neurological exam within normal limits. Discussed trigger avoidance and preventative regimen.',
          diagnosis: 'Episodic Migraine without Aura (ICD-10 G43.009)',
          prescriptionNotes: 'Rizatriptan 10mg orally at migraine onset; Propranolol 40mg daily for preventative control.',
          patientSummary: 'Your headache evaluation indicates episodic migraines. We have prescribed a combination of preventative daily medication and an acute rescue treatment to take at the earliest sign of headache onset. Please maintain a headache diary tracking triggers, sleep hygiene, and hydration.',
          medicationSchedule: JSON.stringify([
            {
              medicationName: 'Rizatriptan',
              dosage: '10mg',
              frequency: 'At headache onset (max 2 doses/24h)',
              instructions: 'Take 1 tablet with water at the first sign of migraine onset.',
            },
            {
              medicationName: 'Propranolol',
              dosage: '40mg',
              frequency: 'Once daily in the morning',
              instructions: 'Take daily every morning with food for preventive control.',
            },
          ]),
          followUpSteps: JSON.stringify([
            'Maintain a daily headache diary recording onset times, severity, and potential dietary triggers.',
            'Ensure adequate fluid intake (at least 2.5 liters of water daily).',
            'Schedule a follow-up consultation in 4 weeks to review treatment efficacy.',
          ]),
          rawLlmResponse: 'Seed post-visit LLM summary response.',
        },
      },
    },
  });

  // Create Active Medication Reminders for Patient 2
  await prisma.medicationReminder.create({
    data: {
      appointmentId: app2.id,
      patientId: patient2.id,
      medicationName: 'Propranolol',
      dosage: '40mg',
      frequency: 'Once daily in the morning',
      instructions: 'Take daily every morning with food.',
      nextRunAt: new Date(today.getTime() + 3600000), // Next run in 1 hour
      isCompleted: false,
    },
  });

  // 5. Seed Sample Email Audit Logs
  await prisma.emailLog.create({
    data: {
      recipient: 'patient1@example.com',
      subject: 'Booking Confirmed with Dr. Robert Smith',
      body: '<p>Your appointment with Dr. Robert Smith has been confirmed.</p>',
      type: 'CONFIRMATION',
      status: 'SENT',
      retryCount: 0,
      createdAt: new Date(today.getTime() - 7200000),
    },
  });

  await prisma.emailLog.create({
    data: {
      recipient: 'patient2@example.com',
      subject: 'Post-Visit Summary & Prescription from Dr. Sarah Connor',
      body: '<p>Consultation summary and prescription schedule available.</p>',
      type: 'SUMMARY',
      status: 'SENT',
      retryCount: 0,
      createdAt: new Date(today.getTime() - 3600000),
    },
  });

  console.log('[Database Seed] Comprehensive medical seed data populated successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
