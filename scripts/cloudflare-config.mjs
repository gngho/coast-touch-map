import {readFileSync, writeFileSync} from 'node:fs';
import {accessIssuer} from '../server/access.mjs';

const file = new URL('../wrangler.json', import.meta.url);
const config = JSON.parse(readFileSync(file, 'utf8'));
if (process.argv.includes('--write')) {
  if (process.env.COAST_D1_DATABASE_ID) config.d1_databases[0].database_id = process.env.COAST_D1_DATABASE_ID;
  for (const key of ['ACCESS_TEAM_DOMAIN', 'ACCESS_AUD', 'ACCESS_ALLOWED_EMAIL']) if (process.env[key]) config.vars[key] = process.env[key];
}
const id = config.d1_databases[0].database_id;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^0+-0+-0+-0+-0+$/.test(id)) {
  throw new Error('Create the Cloudflare D1 database and set its database_id in wrangler.json. See CLOUDFLARE.md.');
}
accessIssuer(config.vars.ACCESS_TEAM_DOMAIN);
if (!config.vars.ACCESS_ALLOWED_EMAIL) throw new Error('ACCESS_ALLOWED_EMAIL is required.');
if (!/^[0-9a-f]{64}$/i.test(config.vars.ACCESS_AUD)) throw new Error('Set the Cloudflare Access application AUD in wrangler.json.');
if (process.argv.includes('--write')) writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
console.log('Cloudflare configuration validated.');
