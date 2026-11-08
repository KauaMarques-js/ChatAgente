const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSafeStorage, validateMessage, guardWorkspace, safeError } = require('../security.cjs');

test('diagnóstico preserva mensagem e retira credenciais conhecidas e padrões de tokens', () => {
  const result = safeError(new Error('HTTP 401 conta: Bearer abc123 access_token=def456 sk-segredo segredo-conhecido'), ['segredo-conhecido']);
  assert.match(result, /HTTP 401 conta/);
  for (const value of ['abc123', 'def456', 'sk-segredo', 'segredo-conhecido']) assert.equal(result.includes(value), false);
});

test('AES-GCM mantém chave no SecretStorage e rejeita adulteração/chave diferente', async () => {
  const records = new Map();
  const secrets = { get: async k => records.get(k), store: async (k, v) => records.set(k, v) };
  const first = await createSafeStorage(secrets);
  const second = await createSafeStorage(secrets);
  const encrypted = first.encryptString('credencial-sintetica');
  assert.equal(encrypted.includes(Buffer.from('credencial-sintetica')), false);
  assert.equal(second.decryptString(encrypted), 'credencial-sintetica');
  assert.notDeepEqual(first.encryptString('credencial-sintetica'), encrypted);
  const changed = Buffer.from(encrypted); changed[changed.length - 1] ^= 1;
  assert.throws(() => second.decryptString(changed));
  const other = await createSafeStorage({ get: async () => undefined, store: async () => {} });
  assert.throws(() => other.decryptString(encrypted));
});

test('mensagens só aceitam comandos e dados previstos', () => {
  for (const command of ['ready', 'stop', 'login', 'logout', 'reset', 'folder', 'terminal', 'git', 'models', 'explorer']) assert.equal(validateMessage({ command }), true);
  for (const value of [null, [], {}, { command: 'executeCommand', value: 'anything' }, { command: 'login', token: 'x' }, { command: 'backend', value: 'shell' }, { command: 'model', value: 'x; rm' }, { command: 'send', value: '  ' }]) assert.equal(validateMessage(value), false);
  assert.equal(validateMessage({ command: 'send', value: 'Investigue o projeto' }), true);
});

test('Workspace recusa buffer não salvo e preserva verificações originais após salvar', t => {
  const { Workspace } = require('../../src/workspace.cjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatagente-editor-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'file.txt'), 'original');
  const doc = { uri: { scheme: 'file', fsPath: path.join(root, 'file.txt') }, isDirty: true };
  const Guarded = guardWorkspace(Workspace, () => [doc]); const workspace = new Guarded(root);
  workspace.readFile('file.txt');
  assert.throws(() => workspace.writeFile('file.txt', 'novo'), /não salvas/);
  assert.equal(fs.readFileSync(doc.uri.fsPath, 'utf8'), 'original');
  doc.isDirty = false;
  workspace.writeFile('file.txt', 'novo');
  assert.equal(fs.readFileSync(doc.uri.fsPath, 'utf8'), 'novo');
  fs.writeFileSync(doc.uri.fsPath, 'externo');
  assert.throws(() => workspace.writeFile('file.txt', 'perda'), /modificado/);
  assert.throws(() => workspace.writeFile('../escape.txt', 'x'), /fora/);
});
