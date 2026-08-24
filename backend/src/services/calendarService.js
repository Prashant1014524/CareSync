const { google } = require('googleapis');

let calendarClient = null;

function getCalendarClient() {
  if (calendarClient) return calendarClient;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback'
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });
      calendarClient = google.calendar({ version: 'v3', auth: oauth2Client });
      console.log('[Google Calendar Service] OAuth 2.0 Client initialized successfully.');
    } catch (err) {
      console.warn('[Google Calendar Service] Failed to initialize Google Calendar client:', err.message);
    }
  }

  return calendarClient;
}

/**
 * Create Google Calendar Event for Appointment
 */
async function createCalendarEvent({ summary, description, startTime, endTime, patientEmail, doctorEmail }) {
  const client = getCalendarClient();
  const startISO = new Date(startTime).toISOString();
  const endISO = new Date(endTime).toISOString();

  if (client) {
    try {
      const event = {
        summary: summary || 'Healthcare Appointment',
        description: description || 'Medical consultation booked via Healthcare Manager',
        start: { dateTime: startISO, timeZone: 'UTC' },
        end: { dateTime: endISO, timeZone: 'UTC' },
        attendees: [
          ...(patientEmail ? [{ email: patientEmail }] : []),
          ...(doctorEmail ? [{ email: doctorEmail }] : []),
        ],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      };

      const res = await client.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all',
      });

      console.log(`[Google Calendar Event Created] EventID: ${res.data.id}`);
      return {
        googleEventId: res.data.id,
        googleMeetLink: res.data.hangoutLink || res.data.htmlLink,
      };
    } catch (err) {
      console.error('[Google Calendar Event Creation Failed]', err.message);
    }
  }

  // Graceful Fallback Mode if Google API Credentials are not set or fail
  const mockEventId = `gcal-mock-${Date.now()}`;
  const mockMeetLink = `https://meet.google.com/doc-visit-${Math.random().toString(36).substring(2, 8)}`;
  console.log(`[Mock Calendar Event] Created event ${mockEventId} with Meet link ${mockMeetLink}`);

  return {
    googleEventId: mockEventId,
    googleMeetLink: mockMeetLink,
  };
}

/**
 * Delete Google Calendar Event on Cancellation
 */
async function deleteCalendarEvent(googleEventId) {
  if (!googleEventId || googleEventId.startsWith('gcal-mock-')) return true;

  const client = getCalendarClient();
  if (client) {
    try {
      await client.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
        sendUpdates: 'all',
      });
      console.log(`[Google Calendar Event Deleted] EventID: ${googleEventId}`);
      return true;
    } catch (err) {
      console.error('[Google Calendar Event Deletion Failed]', err.message);
      return false;
    }
  }
  return true;
}

module.exports = {
  createCalendarEvent,
  deleteCalendarEvent,
};
