const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { withAuthLock, createProfileAuth } = require('../auth-lock.cjs');

test('janelas serializam autenticação e liberam o bloqueio após erro', { skip: process.platform !== 'win32' }, async () => {
  const directory = path.join(os.tmpdir(), crypto.randomUUID());
  let running = 0;
  let maximum = 0;
  await Promise.all(Array.from({ length: 4 }, () => withAuthLock(directory, async () => {
    running++; maximum = Math.max(maximum, running);
    await new Promise(resolve => setTimeout(resolve, 10));
    running--;
  })));
  assert.equal(maximum, 1);
  await assert.rejects(withAuthLock(directory, () => { throw new Error('simulado'); }), /simulado/);
  assert.equal(await withAuthLock(directory, () => 'liberado'), 'liberado');
});

test('janelas recarregam credenciais renovadas e cancelam espera por autenticação', { skip: process.platform !== 'win32' }, async () => {
  const directory = path.join(os.tmpdir(), crypto.randomUUID());
  let persisted = 'inicial';
  class FakeAuth {
    async initialize() { this.record = persisted; }
    async accessToken() { return this.record; }
    async signIn() { persisted = this.record = 'renovado'; }
    async disconnect() { persisted = this.record = null; }
  }
  const first = await createProfileAuth(FakeAuth, { directory }, {}, async () => ({}));
  const second = await createProfileAuth(FakeAuth, { directory }, {}, async () => ({}));
  await first.signIn();
  assert.equal(await second.accessToken(), 'renovado');
  await first.disconnect();
  assert.equal(await second.accessToken(), null);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(second.accessToken(controller.signal), { name: 'AbortError' });
});
