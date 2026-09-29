import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair, SignJWT, exportJWK, createLocalJWKSet} from 'jose';
import {accessIdentity} from '../server/access.mjs';
import {createWorker} from '../server/cloudflare-worker.mjs';
import {localDatabase} from '../server/dev-db.mjs';

const env = {ACCESS_TEAM_DOMAIN: 'https://coast-test.cloudflareaccess.com', ACCESS_AUD: 'coast-app', ACCESS_ALLOWED_EMAIL: 'owner@example.com'};
const {publicKey, privateKey} = await generateKeyPair('RS256');
const keys = createLocalJWKSet({keys: [{...await exportJWK(publicKey), kid: 'test', alg: 'RS256'}]});
async function sign(overrides = {}, key = privateKey) {
  return new SignJWT({email: env.ACCESS_ALLOWED_EMAIL, sub: 'owner', iss: env.ACCESS_TEAM_DOMAIN, aud: env.ACCESS_AUD,
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 300, ...overrides})
    .setProtectedHeader({alg: 'RS256', kid: 'test'}).sign(key);
}
const req = token => new Request('https://coast.example/admin', {headers: token ? {'Cf-Access-Jwt-Assertion': token} : {}});

test('Access verifies signature, issuer, audience, expiry, human identity and allowed email', async () => {
  assert.equal(await accessIdentity(req(await sign()), env, keys), 'cloudflare:owner');
  assert.equal(await accessIdentity(req(), env, keys), null);
  for (const claims of [{iss:'https://other.cloudflareaccess.com'}, {aud:'other'}, {exp:1}, {email:''}, {sub:''}, {email:'other@example.com'}]) {
    assert.equal(await accessIdentity(req(await sign(claims)), env, keys), null);
  }
  const other = await generateKeyPair('RS256');
  assert.equal(await accessIdentity(req(await sign({}, other.privateKey)), env, keys), null);
});

test('missing Access configuration and spoofed legacy headers never expose assets or API', async () => {
  const worker = createWorker();
  const request = new Request('https://coast.example/api/session', {headers: {'oai-authenticated-user-id':'owner'}});
  assert.equal((await worker.fetch(request, {})).status, 503);
  assert.equal((await worker.fetch(request, env)).status, 401);
  assert.equal((await worker.fetch(req(), env)).status, 401);
});

test('verified owner reaches D1 API; supplied legacy identity is replaced and cross-origin writes fail', async () => {
  const DB = localDatabase();
  try {
    const worker = createWorker((r,e) => accessIdentity(r,e,keys));
    const jwt = await sign();
    const request = origin => new Request('https://coast.example/api/session', {method:'POST',
      headers:{origin, 'Cf-Access-Jwt-Assertion':jwt, 'oai-authenticated-user-id':'spoofed'}, body:'{}'});
    assert.equal((await worker.fetch(request('https://other.example'), {...env,DB})).status,403);
    const response = await worker.fetch(request('https://coast.example'), {...env,DB});
    assert.equal(response.status,200);
    assert.ok((await response.json()).adminToken);
    assert.equal((await DB.prepare('SELECT owner FROM sessions').first()).owner,'cloudflare:owner');
  } finally { DB.close(); }
});

test('authenticated routes preserve admin, participant and static paths with no-store headers', async () => {
  const paths = [];
  const worker = createWorker(async () => 'cloudflare:owner');
  const ASSETS = {fetch:async request => {paths.push(new URL(request.url).pathname); return new Response('asset');}};
  for (const [input, expected] of [['/','/index.html'],['/admin','/admin/index.html'],['/admin/','/admin/index.html'],['/app.js','/app.js']]) {
    const response = await worker.fetch(new Request(`https://coast.example${input}`),{ASSETS});
    assert.equal(paths.at(-1),expected);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  }
  assert.equal((await worker.fetch(new Request('https://coast.example/admin',{method:'POST'}),{ASSETS})).status,405);
});
