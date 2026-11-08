const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { ChatGPTAuth } = require('../src/chatgpt-auth.cjs');
const { CodexAgent } = require('../src/codex-agent.cjs');
const { Agent } = require('../src/agent.cjs');

test('ChatGPT salva tokens criptografados fora do projeto e recupera conexão local', async t => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'chatagente-auth-'));
  t.after(() => fs.rm(folder, { recursive: true, force: true }));
  const safeStorage = {
    isEncryptionAvailable: () => true,
    encryptString: text => Buffer.from(text, 'utf8').map(byte => byte ^ 0x73),
    decryptString: bytes => Buffer.from(bytes).map(byte => byte ^ 0x73).toString('utf8'),
  };
  const auth = new ChatGPTAuth({ directory: folder, safeStorage, openBrowser: () => {} });
  await auth.initialize();
  assert.equal(auth.status().connected, false);
  const id = auth.meta.hostId;
  auth.meta.clientId = 'oaiapp_example';
  await auth.saveMeta();
  await auth.saveRecord({ clientId: auth.meta.clientId, email: 'user@example.test',
    accessToken: 'SECRET_VALUE', refreshToken: 'REFRESH_SECRET', scopes: ['chatgpt.tokens.use.direct'],
    expiresAt: Date.now() + 3_600_000 });
  const bytes = await fs.readFile(path.join(auth.directory, 'connection.enc'));
  assert.equal(bytes.includes(Buffer.from('SECRET_VALUE')), false);
  const reopened = new ChatGPTAuth({ directory: folder, safeStorage, openBrowser: () => {} });
  await reopened.initialize();
  assert.equal(reopened.meta.hostId, id);
  assert.equal(reopened.status().sharing, true);
  assert.equal(await reopened.accessToken(), 'SECRET_VALUE');
  reopened.record.refreshToken = undefined; // Este teste cobre exclusão local, sem serviço externo.
  await reopened.disconnect();
  assert.equal(reopened.status().connected, false);
});

test('Codex transmite texto e ações a partir de eventos simulados do SDK', async () => {
  const observed = [];
  let started = 0;
  const thread = {
    runStreamed: async () => ({ events: (async function* () {
      yield { type: 'item.updated', item: { id: 'msg', type: 'agent_message', text: 'Olá' } };
      yield { type: 'item.completed', item: { id: 'msg', type: 'agent_message', text: 'Olá mundo' } };
      yield { type: 'item.completed', item: { type: 'command_execution', command: 'git status', aggregated_output: 'clean', status: 'completed' } };
    })() }),
  };
  const agent = new CodexAgent({ workspace: { root: 'C:\\Dev\\example' }, onEvent: e => observed.push(e),
    codexFactory: async () => ({ startThread: () => { started++; return thread; } }) });
  assert.equal(await agent.send('Verifique Git', new AbortController().signal), 'Olá mundo');
  assert.equal(observed.filter(e => e.type === 'delta').map(e => e.text).join(''), 'Olá mundo');
  assert.equal(observed.some(e => e.type === 'action' && e.name.includes('comando')), true);
  await agent.send('Outro pedido', new AbortController().signal);
  assert.equal(started, 1);
});

test('ChatGPT sem chave pode iniciar agente e sinaliza falta de autenticação ao enviar', async () => {
  const agent = new Agent({ workspace: { root: 'C:\\Dev\\example' } });
  await assert.rejects(agent.send('Olá', new AbortController().signal), /Conecte sua conta ChatGPT/);
});
