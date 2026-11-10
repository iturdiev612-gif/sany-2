import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createApi } from '../server/api.mjs';

const catalog = JSON.parse(await readFile(new URL('../src/data/catalog.json', import.meta.url), 'utf8'));
const password = 'test-only-correct-password-3b6d';
const digest = createHash('sha256').update(password).digest('hex');

class MemoryBucket {
  values = new Map();
  latency = 0;
  async get(key) {
    const value = this.values.get(key);
    if (this.latency) await new Promise(resolve => setTimeout(resolve, this.latency));
    return value === undefined ? null : { json: async () => JSON.parse(value) };
  }
  async put(key, value) { this.values.set(key, value); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', cursor, limit = 1000 }) {
    const all = [...this.values.keys()].filter(key => key.startsWith(prefix)).sort().map(key => ({ key }));
    const start = Number(cursor) || 0;
    return { objects: all.slice(start, start + limit), truncated: all.length > start + limit, cursor: String(start + limit) };
  }
}

function setup(bucket = new MemoryBucket()) {
  const env = { BUCKET: bucket, ADMIN_PASSWORD_SHA256: digest, LOCAL_IP: 'test-client' };
  const api = createApi(catalog);
  async function request(path, { method = 'GET', data, raw, cookie, origin, headers = {} } = {}) {
    const h = { ...headers };
    if (cookie) h.Cookie = cookie;
    if (origin !== undefined) h.Origin = origin;
    const options = { method, headers: h };
    if (!['GET', 'HEAD'].includes(method)) {
      if (!('Content-Type' in h)) h['Content-Type'] = 'application/json';
      options.body = raw === undefined ? JSON.stringify(data ?? {}) : raw;
    }
    return api(new Request('https://catalog.test' + path, options), env);
  }
  async function login() {
    const response = await request('/api/admin/login', { method: 'POST', data: { password } });
    assert.equal(response.status, 200);
    return response.headers.get('Set-Cookie').split(';')[0];
  }
  return { bucket, env, api, request, login };
}

const validLead = { name: 'Test Visitor', phone: '+996 555 123 456', consent: true, productId: catalog[0].id, language: 'ky', message: 'Need a specification' };
const validProduct = { ...catalog[0], name: 'Test model', price: 'By request', availability: 'onRequest', visible: true, power: '', capacity: '', year: '' };

test('public catalog and admin authorization boundary', async () => {
  const s = setup();
  const publicResponse = await s.request('/api/products');
  assert.equal(publicResponse.status, 200);
  assert.equal((await publicResponse.json()).products.length, catalog.length);
  assert.equal(publicResponse.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await (await s.request('/api/admin/session')).json(), { authenticated: false });
  for (const [path, method] of [['/api/admin/data', 'GET'], ['/api/admin/products/test-item', 'PUT'], ['/api/admin/settings', 'PUT'], ['/api/admin/leads/123', 'PATCH']]) {
    assert.equal((await s.request(path, { method })).status, 401, `${method} ${path}`);
  }
});

test('password hash login, secure cookie, session expiry and logout', async () => {
  const s = setup();
  assert.equal((await s.request('/api/admin/login', { method: 'POST', data: { password: 'incorrect' } })).status, 401);
  const response = await s.request('/api/admin/login', { method: 'POST', data: { password } });
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('Set-Cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /Max-Age=28800/);
  const cookie = setCookie.split(';')[0];
  assert.deepEqual(await (await s.request('/api/admin/session', { cookie })).json(), { authenticated: true });
  assert.equal((await s.request('/api/admin/data', { cookie })).status, 200);
  assert.equal((await s.request('/api/admin/data', { cookie: 'sany_session=forged-token-123' })).status, 401);
  const logout = await s.request('/api/admin/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('Set-Cookie'), /Max-Age=0/);
  assert.equal((await s.request('/api/admin/data', { cookie })).status, 401);
  const cookie2 = await s.login();
  const sessionKey = [...s.bucket.values.keys()].find(k => k.startsWith('sessions/'));
  await s.bucket.put(sessionKey, JSON.stringify({ expires: Date.now() - 1 }));
  assert.equal((await s.request('/api/admin/data', { cookie: cookie2 })).status, 401);
});

test('admin remains disabled without password configuration', async () => {
  const s = setup();
  delete s.env.ADMIN_PASSWORD_SHA256;
  assert.equal((await s.request('/api/admin/login', { method: 'POST', data: { password } })).status, 503);
});

test('lead validation, persistence, privacy, statuses and honeypot', async () => {
  const s = setup();
  for (const data of [{ ...validLead, name: 'A' }, { ...validLead, phone: 'bad-number' }, { ...validLead, consent: false }, { ...validLead, phone: '+123' }, { ...validLead, productId: 'nonexistent-model' }]) {
    assert.equal((await s.request('/api/leads', { method: 'POST', data })).status, 400);
  }
  assert.equal([...s.bucket.values.keys()].filter(k => k.startsWith('leads/')).length, 0);
  const response = await s.request('/api/leads', { method: 'POST', data: validLead });
  assert.equal(response.status, 201);
  const { id } = await response.json();
  const saved = await (await s.bucket.get(`leads/${id}`)).json();
  assert.equal(saved.name, validLead.name);
  assert.equal(saved.language, 'ky');
  assert.equal(saved.status, 'new');
  assert.equal(saved.productName, catalog[0].name);
  assert.ok(saved.consentAt);
  assert.equal((await s.request('/api/leads')).status, 404);
  const cookie = await s.login();
  const admin = await (await s.request('/api/admin/data', { cookie })).json();
  assert.equal(admin.leads.length, 1);
  assert.equal(admin.stats.totalLeads, 1);
  assert.equal(admin.stats.newLeads, 1);
  assert.equal((await s.request(`/api/admin/leads/${id}`, { method: 'PATCH', data: { status: 'bad' }, cookie })).status, 400);
  for (const status of ['work', 'done', 'new']) {
    assert.equal((await s.request(`/api/admin/leads/${id}`, { method: 'PATCH', data: { status }, cookie })).status, 200);
    assert.equal((await (await s.bucket.get(`leads/${id}`)).json()).status, status);
  }
  assert.equal((await s.request('/api/admin/leads/00000000-0000-0000-0000-000000000000', { method: 'PATCH', data: { status: 'done' }, cookie })).status, 404);
  const trap = await s.request('/api/leads', { method: 'POST', data: { website: 'spam' } });
  assert.equal(trap.status, 200);
  assert.equal([...s.bucket.values.keys()].filter(k => k.startsWith('leads/')).length, 1);
});

test('product create, edit, visibility, lead rejection and deletion', async () => {
  const s = setup();
  const cookie = await s.login();
  const id = 'custom-test-truck';
  assert.equal((await s.request(`/api/admin/products/${id}`, { method: 'PUT', data: { ...validProduct, category: 'bad' }, cookie })).status, 400);
  assert.equal((await s.request(`/api/admin/products/${id}`, { method: 'PUT', data: { ...validProduct, description: { ru: 'Only Russian' } }, cookie })).status, 400);
  assert.equal((await s.request(`/api/admin/products/${id}`, { method: 'PUT', data: validProduct, cookie })).status, 200);
  let products = (await (await s.request('/api/products')).json()).products;
  assert.equal(products.find(p => p.id === id).name, 'Test model');
  assert.equal((await s.request(`/api/admin/products/${id}`, { method: 'PUT', data: { ...validProduct, name: 'Edited', visible: false }, cookie })).status, 200);
  products = (await (await s.request('/api/products')).json()).products;
  assert.equal(products.some(p => p.id === id), false);
  const admin = await (await s.request('/api/admin/data', { cookie })).json();
  assert.equal(admin.products.find(p => p.id === id).name, 'Edited');
  assert.equal((await s.request('/api/leads', { method: 'POST', data: { ...validLead, productId: id } })).status, 400);
  assert.equal((await s.request(`/api/admin/products/${id}`, { method: 'DELETE', cookie })).status, 200);
  assert.equal((await (await s.request('/api/admin/data', { cookie })).json()).products.some(p => p.id === id), false);
});

test('contact settings validate and are visible to visitors', async () => {
  const s = setup();
  const cookie = await s.login();
  assert.equal((await s.request('/api/admin/settings', { method: 'PUT', data: { email: 'invalid' }, cookie })).status, 400);
  assert.equal((await s.request('/api/admin/settings', { method: 'PUT', data: { phone: 'not a phone' }, cookie })).status, 400);
  const settings = { phone: '+996 555 123456', email: 'sales@example.test', address: 'Test address' };
  assert.equal((await s.request('/api/admin/settings', { method: 'PUT', data: settings, cookie })).status, 200);
  assert.deepEqual((await (await s.request('/api/products')).json()).settings, settings);
  assert.deepEqual((await (await s.request('/api/admin/data', { cookie })).json()).settings, settings);
});

test('origin, content type, malformed JSON and storage errors', async () => {
  const s = setup();
  const cookie = await s.login();
  assert.equal((await s.request('/api/admin/settings', { method: 'PUT', data: {}, cookie, origin: 'https://attacker.test' })).status, 403);
  assert.equal((await s.request('/api/leads', { method: 'POST', data: validLead, origin: 'null' })).status, 403);
  assert.equal((await s.request('/api/leads', { method: 'POST', data: validLead, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await s.request('/api/leads', { method: 'POST', raw: '{bad' })).status, 400);
  assert.equal((await s.request('/api/leads', { method: 'POST', raw: 'x'.repeat(32769) })).status, 400);
  const unicodeLarge = await s.request('/api/leads', { method: 'POST', data: { ...validLead, message: 'я'.repeat(17000) } });
  assert.equal(unicodeLarge.status, 400);
  assert.equal((await unicodeLarge.json()).error, 'BODY_TOO_LARGE');
  assert.equal((await s.request('/api/leads', { method: 'POST', data: validLead, origin: 'https://catalog.test' })).status, 201);
  delete s.env.BUCKET;
  const fallback = await s.request('/api/products');
  assert.equal(fallback.status, 200);
  const publicData = await fallback.json();
  assert.equal(publicData.settings.phone, '+996 707 108 410');
  assert.deepEqual(publicData.capabilities, {admin:false,leads:false});
  assert.equal(publicData.products.length, catalog.length);
  assert.equal((await s.request('/api/leads', {method:'POST',data:validLead})).status, 503);
});

test('visitor deduplication and storage list pagination', async () => {
  const s = setup();
  const id = 'visitor-0123456789abcdef';
  for (let i = 0; i < 2; i++) assert.equal((await s.request('/api/visit', { method: 'POST', data: { id } })).status, 200);
  assert.equal((await s.request('/api/visit', { method: 'POST', data: { id: 'short' } })).status, 400);
  const cookie = await s.login();
  const first = await (await s.request('/api/admin/data', { cookie })).json();
  assert.equal(first.stats.visitors, 1);
  for (let i = 0; i < 1002; i++) await s.bucket.put(`visits/test/${i}`, JSON.stringify({ day: 'test' }));
  const paginated = await (await s.request('/api/admin/data', { cookie })).json();
  assert.equal(paginated.stats.visitors, 1003);
});

test('sequential abuse limits apply to login and leads', async () => {
  const s = setup();
  for (let i = 0; i < 8; i++) assert.equal((await s.request('/api/admin/login', { method: 'POST', data: { password: 'wrong' } })).status, 401);
  assert.equal((await s.request('/api/admin/login', { method: 'POST', data: { password } })).status, 429);
  for (let i = 0; i < 5; i++) assert.equal((await s.request('/api/leads', { method: 'POST', data: validLead })).status, 201);
  assert.equal((await s.request('/api/leads', { method: 'POST', data: validLead })).status, 429);
});

test('regression: JSON null is rejected as bad input on all write endpoints', async () => {
  const s = setup();
  const cookie = await s.login();
  for (const [path, method] of [['/api/leads', 'POST'], ['/api/visit', 'POST'], ['/api/admin/login', 'POST'], ['/api/admin/settings', 'PUT'], ['/api/admin/products/test-null', 'PUT']]) {
    for (const raw of ['null', '[]', '"text"', '42']) assert.equal((await s.request(path, { method, raw, cookie })).status, 400, `${method} ${path} ${raw}`);
  }
});

test('regression: products cannot reference absent image assets', async () => {
  const s = setup();
  const cookie = await s.login();
  for (const image of ['truck-00', 'truck-99']) {
    assert.equal((await s.request('/api/admin/products/test-image', { method: 'PUT', data: { ...validProduct, image }, cookie })).status, 400, image);
  }
});

test('parallel requests obey the per-instance rate counter', async t => {
  const s = setup();
  s.bucket.latency = 10; // R2 network reads overlap; a synchronous Map hides this race.
  const responses = await Promise.all(Array.from({ length: 20 }, () => s.request('/api/admin/login', { method: 'POST', data: { password: 'wrong' } })));
  const attempted = responses.filter(r => r.status === 401).length;
  t.diagnostic(`20 concurrent login attempts: ${attempted} checked passwords, ${responses.filter(r => r.status === 429).length} rate-limited`);
  assert.equal(attempted, 8);
  assert.equal(responses.filter(r => r.status === 429).length, 12);
});

class ConditionalBucket extends MemoryBucket {
  etags = new Map();
  version = 0;
  conditionalFailures = 0;
  async get(key) {
    const value = this.values.get(key), etag = this.etags.get(key);
    await new Promise(resolve => setTimeout(resolve, 5));
    return value === undefined ? null : { etag, json: async () => JSON.parse(value) };
  }
  async put(key, value, { onlyIf } = {}) {
    const existing = this.etags.get(key);
    if ((onlyIf?.etagDoesNotMatch === '*' && this.values.has(key)) || (onlyIf?.etagMatches !== undefined && onlyIf.etagMatches !== existing)) {
      this.conditionalFailures++;
      return null;
    }
    const etag = String(++this.version);
    this.values.set(key, value);
    this.etags.set(key, etag);
    return { etag };
  }
}

test('R2 conditional writes enforce the limit across separate API instances', async t => {
  const bucket = new ConditionalBucket();
  const instances = Array.from({ length: 20 }, () => setup(bucket));
  const responses = await Promise.all(instances.map(s => s.request('/api/admin/login', { method: 'POST', data: { password: 'wrong' } })));
  assert.equal(responses.filter(r => r.status === 401).length, 8);
  assert.equal(responses.filter(r => r.status === 429).length, 12);
  const key = [...bucket.values.keys()].find(k => k.startsWith('rates/login/'));
  assert.equal((await (await bucket.get(key)).json()).count, 8);
  assert.ok(bucket.conditionalFailures > 0);
  t.diagnostic(`${bucket.conditionalFailures} overlapping writes rejected by ETag checks; stored count remains 8`);
});

test('rate limiter denies after bounded repeated conditional conflicts', async () => {
  const bucket = new MemoryBucket();
  let attempts = 0;
  bucket.put = async () => { attempts++; return null; };
  const s = setup(bucket);
  assert.equal((await s.request('/api/admin/login', { method: 'POST', data: { password } })).status, 429);
  assert.equal(attempts, 12);
});

