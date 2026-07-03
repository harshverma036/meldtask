import { OAuth2Client } from "google-auth-library";

// Lazy-initialized — env vars may not be loaded at module evaluation time (ESM hoisting).
let _client: OAuth2Client | null = null;

function getClient(): OAuth2Client {
  if (!_client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID environment variable is not set. Check your .env file.");
    }
    _client = new OAuth2Client(clientId);
  }
  return _client;
}

interface GoogleUserInfo {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  googleId: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) {
    throw new Error("GOOGLE_CLIENT_ID environment variable is not set");
  }

  const ticket = await getClient().verifyIdToken({
    idToken,
    audience,
  });
  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    throw new Error("Invalid Google token: missing email");
  }
  return {
    email: payload.email,
    name: payload.name || null,
    avatarUrl: payload.picture || null,
    googleId: payload.sub,
  };
}
