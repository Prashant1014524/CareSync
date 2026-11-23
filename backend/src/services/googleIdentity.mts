import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

async function verifyGoogleIdentity(credential: string, clientId: string) {
  const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
  const claims = ticket.getPayload();
  if (!claims?.sub || !claims.email || !claims.email_verified) return null;

  const email = claims.email.trim().toLowerCase();
  if (!email.endsWith('@gmail.com') && !claims.hd) return null;

  return {
    subject: claims.sub,
    email,
    name: claims.name?.trim() || email.split('@')[0],
  };
}

export { verifyGoogleIdentity };
