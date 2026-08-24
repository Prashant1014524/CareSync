const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey && apiKey.trim() !== '') {
  try {
    genAI = new GoogleGenerativeAI(apiKey);
  } catch (err) {
    console.warn('[LLM Service] Failed to initialize GoogleGenerativeAI:', err.message);
  }
}

/**
 * Generate Pre-Visit Summary from Symptoms
 * Required format: { urgencyLevel: "Low" | "Medium" | "High", chiefComplaint: string, suggestedQuestions: string[] }
 */
async function generatePreVisitSummary(symptomsData) {
  const { symptoms, duration, severity, medicalHistory } = symptomsData;
  const promptText = `
Analyse these symptoms and return a JSON object with:
1. "urgencyLevel": string (Must be strictly one of: "Low", "Medium", "High")
2. "chiefComplaint": string (A concise summary of the primary complaint)
3. "suggestedQuestions": string[] (Array of exactly three relevant questions for the doctor to ask during consultation)

Patient Symptoms: ${symptoms}
Duration: ${duration || 'Not specified'}
Severity: ${severity || 'Not specified'}
Relevant Medical History: ${medicalHistory || 'None provided'}

Return ONLY valid JSON matching this schema without markdown codeblocks:
{
  "urgencyLevel": "Low" | "Medium" | "High",
  "chiefComplaint": "Concise summary...",
  "suggestedQuestions": ["Question 1?", "Question 2?", "Question 3?"]
}
  `.trim();

  let rawOutput = '';
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(promptText);
      const response = await result.response;
      rawOutput = response.text() || '';
    } catch (err) {
      console.warn('[LLM Service] Gemini API call failed for pre-visit summary:', err.message);
    }
  }

  // Parse JSON response or fallback gracefully
  try {
    if (rawOutput) {
      const cleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.urgencyLevel && parsed.chiefComplaint && Array.isArray(parsed.suggestedQuestions)) {
        const validLevels = ['Low', 'Medium', 'High'];
        const urgency = validLevels.includes(parsed.urgencyLevel) ? parsed.urgencyLevel : 'Medium';
        return {
          urgencyLevel: urgency,
          chiefComplaint: parsed.chiefComplaint,
          suggestedQuestions: parsed.suggestedQuestions.slice(0, 3),
          rawLlmResponse: rawOutput,
        };
      }
    }
  } catch (e) {
    console.warn('[LLM Service] Pre-visit JSON parsing failed, using fallback parser.', e.message);
  }

  return fallbackPreVisitSummary(symptomsData);
}

/**
 * Generate Post-Visit Summary from Doctor's Notes & Prescription
 */
async function generatePostVisitSummary(clinicalNotesData) {
  const { clinicalNotes, diagnosis, prescriptionNotes } = clinicalNotesData;

  const promptText = `
Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps.

Clinical Notes: ${clinicalNotes}
Diagnosis: ${diagnosis || 'Not specified'}
Prescription & Treatment Plan: ${prescriptionNotes || 'None specified'}

Return ONLY valid JSON matching this schema without markdown codeblocks:
{
  "patientSummary": "A clear, empathetic, patient-friendly summary of the diagnosis and visit outcomes...",
  "medicationSchedule": [
    {
      "medicationName": "Name of medicine",
      "dosage": "e.g., 500mg",
      "frequency": "e.g., Twice daily after meals",
      "instructions": "e.g., Take with full glass of water for 5 days"
    }
  ],
  "followUpSteps": [
    "Step 1: Get rest and stay hydrated",
    "Step 2: Follow-up visit in 2 weeks"
  ]
}
  `.trim();

  let rawOutput = '';
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(promptText);
      const response = await result.response;
      rawOutput = response.text() || '';
    } catch (err) {
      console.warn('[LLM Service] Gemini API call failed for post-visit summary:', err.message);
    }
  }

  try {
    if (rawOutput) {
      const cleaned = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.patientSummary && Array.isArray(parsed.medicationSchedule)) {
        return {
          patientSummary: parsed.patientSummary,
          medicationSchedule: parsed.medicationSchedule,
          followUpSteps: parsed.followUpSteps || ['Follow up with your doctor if symptoms persist.'],
          rawLlmResponse: rawOutput,
        };
      }
    }
  } catch (e) {
    console.warn('[LLM Service] Post-visit JSON parsing failed, using fallback parser.', e.message);
  }

  return fallbackPostVisitSummary(clinicalNotesData);
}

function fallbackPreVisitSummary({ symptoms, severity }) {
  const isHigh = /severe|chest pain|shortness of breath|unconscious|bleeding/i.test(symptoms);
  const urgencyLevel = isHigh ? 'High' : (severity === 'Severe' ? 'High' : (severity === 'Moderate' ? 'Medium' : 'Low'));

  return {
    urgencyLevel,
    chiefComplaint: `Patient presents with: ${symptoms.slice(0, 100)}...`,
    suggestedQuestions: [
      'How often does this symptom occur during daily activities?',
      'Have you noticed any aggravating or relieving factors?',
      'Are you taking any over-the-counter remedies for this condition?',
    ],
    rawLlmResponse: '[Fallback Generated - LLM Service Unavailable]',
  };
}

function fallbackPostVisitSummary({ clinicalNotes, diagnosis, prescriptionNotes }) {
  return {
    patientSummary: `Summary of Visit: ${diagnosis ? `Diagnosed with ${diagnosis}. ` : ''}${clinicalNotes}`,
    medicationSchedule: prescriptionNotes ? [
      {
        medicationName: prescriptionNotes.split(',')[0] || 'Prescribed Medication',
        dosage: 'As prescribed',
        frequency: 'Once daily after meals',
        instructions: 'Take as directed by your physician.',
      }
    ] : [],
    followUpSteps: [
      'Take all medications as prescribed by your physician.',
      'Contact clinic immediately if symptoms worsen or side-effects occur.',
      'Schedule a follow-up consultation in 1-2 weeks.',
    ],
    rawLlmResponse: '[Fallback Generated - LLM Service Unavailable]',
  };
}

module.exports = {
  generatePreVisitSummary,
  generatePostVisitSummary,
};
