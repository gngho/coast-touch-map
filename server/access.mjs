import {createRemoteJWKSet, jwtVerify} from 'jose';

const keySets = new Map();
export function accessIssuer(teamDomain) {
  if (typeof teamDomain !== 'string' || !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)) {
    throw new Error('ACCESS_TEAM_DOMAIN must be https://<team>.cloudflareaccess.com');
  }
  return teamDomain;
}

export async function accessIdentity(request, env, resolveKeys) {
  const issuer = accessIssuer(env.ACCESS_TEAM_DOMAIN);
  if (!env.ACCESS_AUD) throw new Error('ACCESS_AUD is required');
  if (!env.ACCESS_ALLOWED_EMAIL) throw new Error('ACCESS_ALLOWED_EMAIL is required');
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return null;
  if (!resolveKeys) {
    if (!keySets.has(issuer)) keySets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    resolveKeys = keySets.get(issuer);
  }
  try {
    const {payload} = await jwtVerify(token, resolveKeys, {
      issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat'],
    });
    // A human identity is required; service tokens cannot recover experiment sessions.
    if (typeof payload.sub !== 'string' || !payload.sub || typeof payload.email !== 'string' || !payload.email) return null;
    if (payload.email.toLowerCase() !== env.ACCESS_ALLOWED_EMAIL.toLowerCase()) return null;
    return `cloudflare:${payload.sub}`;
  } catch {
    return null;
  }
}
