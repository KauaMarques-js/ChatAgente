const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { Workspace } = require('../../src/workspace.cjs');

function load(vscode) {
  const original = Module._load;
  delete require.cache[require.resolve('../extension.cjs')];
  try {
    Module._load = function(name, ...args) { return name === 'vscode' ? vscode : original.call(this, name, ...args); };
    return require('../extension.cjs').ChatView;
  } finally { Module._load = original; }
}
function environment() {
  return {
    StatusBarAlignment: { Left: 1 }, ViewColumn: { One: 1 },
    commands: { executeCommand: async () => {} },
    Uri: { joinPath: (uri, ...parts) => ({ fsPath: path.join(uri.fsPath, ...parts) }) },
    window: { createStatusBarItem: () => ({ show() {}, dispose() {} }) },
    workspace: { isTrusted: true, workspaceFolders: [], textDocuments: [] },
  };
}
function context() { return { extensionPath: path.resolve(__dirname, '..'), extensionUri: { fsPath: path.resolve(__dirname, '..') }, subscriptions: [] }; }

test('ChatGPT padrão conversa sem pasta, agrega tokens e nunca instancia Codex', async () => {
  const vscode = environment();
  const ChatView = load(vscode);
  let codex = 0;
  class DirectChat {
    constructor(options) { assert.equal(options.workspace, null); this.events = options.onEvent; }
    async send() {
      this.events({ type: 'usage', usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120, cachedInputTokens: 50, reasoningTokens: 10 } });
      this.events({ type: 'usage', usage: { inputTokens: 30, outputTokens: 5, totalTokens: 35 } });
      return 'Resposta direta';
    }
    reset() {}
  }
  const provider = new ChatView(context(), { Workspace, Agent: DirectChat, CodexAgent: class { constructor() { codex++; throw new Error('Não usar Codex'); } } }, { status: () => ({ connected: true, sharing: true }) });
  provider.model = 'modelo-teste';
  await provider.handle({ command: 'send', value: 'Uma pergunta simples' });
  assert.equal(codex, 0);
  assert.equal(provider.getState().backend, 'chatgpt');
  assert.equal(provider.getState().usage.turn.totalTokens, 155);
  assert.equal(provider.getState().usage.turn.inputTokens, 130);
  assert.equal(provider.getState().usage.turn.requests, 2);
  assert.equal(provider.entries.at(-1).text, 'Resposta direta');
  await provider.handle({ command: 'send', value: 'Outra pergunta' });
  assert.equal(provider.getState().usage.turn.totalTokens, 155);
  assert.equal(provider.getState().usage.session.totalTokens, 310);
  await provider.handle({ command: 'reset' });
  assert.equal(provider.getState().usage.session.totalTokens, null);
  provider.dispose();
});

test('chat abre no editor central e reabre sem criar painel duplicado ou perder conversa', () => {
  const vscode = environment();
  let created = 0; let revealed = 0; let closed;
  const panel = { viewColumn: 1, reveal() { revealed++; }, dispose() { closed(); }, onDidDispose(fn) { closed = fn; },
    webview: { cspSource: 'vscode-webview:', asWebviewUri: value => value.fsPath, onDidReceiveMessage() {}, postMessage() {} } };
  vscode.window.createWebviewPanel = (type, title, column) => { assert.equal(type, 'chatagente.conversation'); assert.equal(column, 1); created++; return panel; };
  const ChatView = load(vscode);
  const provider = new ChatView(context(), { Workspace }, { status: () => ({ connected: false }) });
  provider.openChat();
  assert.equal(provider.getState().chatLocation, 'editor');
  assert.match(panel.webview.html, /Content-Security-Policy/);
  provider.entry({ type: 'user', text: 'Conversa preservada' });
  provider.openChat();
  assert.equal(created, 1);
  assert.equal(revealed, 1);
  panel.dispose();
  assert.equal(provider.getState().chatLocation, null);
  assert.equal(provider.entries.at(-1).text, 'Conversa preservada');
  provider.dispose();
});
