const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const runtime = require('../../src/workspace.cjs');

test('bridge bloqueia troca/reset durante tarefa e stop cancela signal sem persistir conversa', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'chatagente-bridge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const statusBar = { show() {}, dispose() {} };
  const vscode = {
    StatusBarAlignment: { Left: 1 },
    window: { createStatusBarItem: () => statusBar },
    workspace: { isTrusted: true, workspaceFolders: [{ uri: { scheme: 'file', fsPath: root } }], textDocuments: [] },
  };
  const originalLoad = Module._load;
  let ChatView;
  try {
    Module._load = function(name, ...args) { return name === 'vscode' ? vscode : originalLoad.call(this, name, ...args); };
    ({ ChatView } = require('../extension.cjs'));
  } finally { Module._load = originalLoad; }
  let started;
  const running = new Promise(resolve => { started = resolve; });
  class Agent {
    reset() {}
    async send(text, signal) {
      started();
      await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
      throw new Error('cancelado');
    }
  }
  const provider = new ChatView({ globalStorageUri: { fsPath: path.join(root, 'storage') } }, { ...runtime, Agent }, { status: () => ({ connected: true, sharing: true }) });
  t.after(() => provider.dispose());
  provider.model = 'modelo-teste';
  const sending = provider.handle({ command: 'send', value: 'tarefa sintética' });
  await running;
  assert.match(statusBar.text, /ChatGPT/);
  await assert.rejects(provider.handle({ command: 'backend', value: 'codex' }), /Finalize/);
  await assert.rejects(provider.handle({ command: 'reset' }), /Finalize/);
  await provider.handle({ command: 'stop' });
  await sending;
  assert.equal(provider.controller, null);
  assert.equal(provider.entries.at(-1).type, 'error');
  await provider.handle({ command: 'reset' });
  assert.deepEqual(provider.entries, []);
  await provider.selectAgent('codex');
  assert.equal(provider.getState().backend, 'codex');
  assert.equal(statusBar.command, 'chatagente.selectAgent');
  await provider.selectAgent('chatgpt');
  assert.equal(provider.getState().backend, 'chatgpt');
  assert.equal(provider.getState().project, fs.realpathSync(root));
  assert.equal('record' in provider.getState(), false);
  await assert.rejects(provider.selectAgent('shell'), /inválido/);
  assert.equal(fs.existsSync(path.join(root, 'storage')), false);
  await assert.rejects(provider.handle({ command: 'executeCommand', value: 'x' }), /inválido/);
});
