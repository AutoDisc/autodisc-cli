import type { AuthCredentialType } from '../../types.js';

export function credentialTypeForToken(
  token: string,
  explicit?: AuthCredentialType,
): AuthCredentialType {
  if (explicit) return explicit;
  return token.trim().startsWith('adk_') ? 'api_key' : 'session';
}

export function environmentCredential():
  | { token: string; credentialType: AuthCredentialType }
  | undefined {
  const apiKey = process.env.AUTODISC_API_KEY?.trim();
  if (apiKey) return { token: apiKey, credentialType: 'api_key' };

  const token = process.env.AUTODISC_TOKEN?.trim();
  if (!token) return undefined;
  return { token, credentialType: credentialTypeForToken(token) };
}

export function credentialHeaders(
  token: string,
  credentialType?: AuthCredentialType,
): Record<string, string> {
  return credentialTypeForToken(token, credentialType) === 'api_key'
    ? { 'X-API-Key': token }
    : { Authorization: `Bearer ${token}` };
}
