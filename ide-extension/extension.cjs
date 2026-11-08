const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createSafeStorage, validateMessage, guardWorkspace, safeError } = require('./security.cjs');
const { createProfileAuth } = require('./auth-lock.cjs');

function codexPath() {
  const base = path.dirname(require.resolve('@openai/codex-win32-x64/package.json'));
  const executable = path.join(base, 'vendor', 'x86_64-pc-windows-msvc', 'bin', 'codex.exe');
  if (!fs.existsSync(executable)) throw new Error('Codex CLI Windows x64 ausente no pacote.');
  return executable;
}

class ChatView {
  constructor(context, runtime, auth) {
    this.context = context; this.runtime = { ...runtime, Workspace: guardWorkspace(runtime.Workspace, () => vscode.workspace.textDocuments) }; this.auth = auth;
    this.backend = 'chatgpt'; this.models = []; this.model = ''; this.codexModel = '';
    this.entries = []; this.controller = null; this.loginController = null; this.agents = {};
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    this.statusBar.command = 'chatagente.selectAgent';
    this.statusBar.tooltip = 'Selecionar agente ChatGPT ou Codex';
    this.statusBar.show();
  }
  error(error) {
    const record = this.auth.record;
    return safeError(error, [record?.accessToken, record?.refreshToken, record?.idToken,
      record?.pendingRefresh?.accessToken, record?.pendingRefresh?.refreshToken, record?.pendingRefresh?.idToken]);
  }
  post(message) { if (this.view) void this.view.webview.postMessage(message); }
  getState() {
    const folders = vscode.workspace.workspaceFolders || [];
    return { backend: this.backend, project: this.workspace?.root || (folders.length === 1 && folders[0].uri.scheme === 'file' ? folders[0].uri.fsPath : ''),
      busy: Boolean(this.controller || this.loginController), model: this.backend === 'codex' ? this.codexModel : this.model,
      connected: Boolean(this.auth.status().connected) };
  }
  async selectAgent(value) {
    this.idle();
    if (value === undefined) {
      const item = await vscode.window.showQuickPick([
        { label: 'ChatGPT', value: 'chatgpt', description: 'Ferramentas ChatAgente e aprovações por ação' },
        { label: 'Codex', value: 'codex', description: 'SDK oficial e autorização por tarefa' },
      ], { placeHolder: 'Selecione o agente ChatAgente' });
      if (!item) return;
      value = item.value;
    }
    await this.handle({ command: 'backend', value });
  }
  state() {
    this.statusBar.text = `$(comment-discussion) ${this.backend === 'codex' ? 'Codex' : 'ChatGPT'} · ${this.backend === 'codex' ? this.codexModel || 'padrão CLI' : this.model || 'sem modelo'}${this.controller ? ' $(sync~spin)' : ''}`;
    this.post({ type: 'state', backend: this.backend, model: this.backend === 'codex' ? this.codexModel : this.model,
      models: this.backend === 'chatgpt' ? this.models : [], connected: this.auth.status().connected,
      busy: Boolean(this.controller || this.loginController), directory: this.getState().project });
  }
  entry(event) {
    const sanitized = {};
    for (const key of ['type', 'text', 'name', 'status', 'output']) {
      if (typeof event[key] === 'string') sanitized[key] = this.error(new Error(event[key]));
    }
    this.entries.push(sanitized); this.post({ type: 'event', event: sanitized });
  }
  idle() { if (this.controller || this.loginController) throw new Error('Finalize ou interrompa a execução primeiro.'); }
  async selectWorkspace() {
    const folders = (vscode.workspace.workspaceFolders || []).filter(f => f.uri.scheme === 'file');
    if (!folders.length) throw new Error('Abra uma pasta local na IDE.');
    const folder = folders.length === 1 ? folders[0] : await vscode.window.showWorkspaceFolderPick({ placeHolder: 'Projeto para esta tarefa' });
    if (!folder) throw new Error('Seleção de projeto cancelada.');
    if (this.workspace?.root !== fs.realpathSync(folder.uri.fsPath)) {
      this.workspace = new this.runtime.Workspace(folder.uri.fsPath); this.agents = {};
      this.entries = []; this.post({ type: 'clear' });
    }
    return this.workspace;
  }
  async approve(name, args) {
    const signal = this.controller?.signal;
    if (!signal || signal.aborted) return false;
    const detail = name === 'run_command' ? `Pode acessar outras pastas e a rede.\n\n${args.command}` : `${args.path}\n${args.bytes} bytes\n\n${args.preview}`;
    const answer = await vscode.window.showWarningMessage(name === 'run_command' ? 'Permitir comando PowerShell?' : 'Permitir alteração de arquivo?', { modal: true, detail }, 'Permitir uma vez');
    return answer === 'Permitir uma vez' && !signal.aborted;
  }
  async agent() {
    if (this.agents[this.backend]) return this.agents[this.backend];
    const common = { workspace: this.workspace, onEvent: e => this.entry(e) };
    if (this.backend === 'chatgpt') {
      if (!this.auth.status().sharing || !this.model) throw new Error('Entre com ChatGPT e selecione um modelo disponível.');
      const OpenAI = require('openai');
      this.agents.chatgpt = new this.runtime.Agent({ ...common, model: this.model, sharing: true,
        approve: (name, args) => this.approve(name, args), clientFactory: async () => {
          const token = await this.auth.accessToken(this.controller?.signal);
          return new OpenAI({ apiKey: token, baseURL: 'https://api.openai.com/v1', logLevel: 'off', organization: null, project: null,
            maxRetries: 0, fetchOptions: { redirect: 'error' }, defaultHeaders: { authorization: `Bearer ${token}`, 'openai-organization': null, 'openai-project': null } });
        } });
    } else {
      this.agents.codex = new this.runtime.CodexAgent({ ...common, codexFactory: async () => {
        const { Codex } = await import('@openai/codex-sdk');
        const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => typeof v === 'string'));
        const codex = new Codex({ env });
        return { startThread: options => codex.startThread({ ...options, ...(this.codexModel ? { model: this.codexModel } : {}) }) };
      } });
    }
    return this.agents[this.backend];
  }
  async loadModels() {
    this.models = await this.auth.models();
    if (!this.models.some(m => m.slug === this.model)) this.model = this.models[0]?.slug || '';
  }
  async send(text) {
    this.idle();
    if (!vscode.workspace.isTrusted) throw new Error('Confie no projeto antes de executar agentes.');
    this.controller = new AbortController(); this.state();
    try {
      await this.selectWorkspace();
      this.state();
      if (this.backend === 'codex') {
        if (vscode.workspace.textDocuments.some(doc => doc.isDirty && doc.uri.scheme === 'file' && this.runtime.isInside(this.workspace.root, doc.uri.fsPath))) {
          throw new Error('Salve os arquivos do projeto antes de iniciar o Codex.');
        }
        const answer = await vscode.window.showWarningMessage('Autorizar esta tarefa Codex?', { modal: true,
          detail: `Projeto: ${this.workspace.root}\n\n${text}\n\nCodex poderá ler e alterar arquivos e executar comandos na sandbox workspace-write, sem aprovações individuais. Não amplia acesso fora dessa política.` }, 'Autorizar tarefa');
        if (answer !== 'Autorizar tarefa' || this.controller.signal.aborted) return;
      }
      this.controller.signal.throwIfAborted();
      const agent = await this.agent();
      this.entry({ type: 'user', text }); this.entry({ type: 'start' });
      const answer = await agent.send(text, this.controller.signal);
      this.entry({ type: 'done', text: answer });
    } catch (error) { this.entry({ type: 'error', text: this.controller.signal.aborted ? 'Tarefa interrompida. Efeitos já aplicados permanecem.' : this.error(error) }); }
    finally { this.controller = null; this.state(); }
  }
  async handle(message) {
    if (!validateMessage(message)) throw new Error('Comando inválido.');
    const { command, value } = message;
    if (command === 'ready') { this.post({ type: 'history', entries: this.entries }); this.state(); return; }
    if (command === 'stop') { this.controller?.abort(); this.loginController?.abort(); return; }
    if (command === 'send') return this.send(value);
    this.idle();
    if (command === 'backend') { this.backend = value; this.agents[value]?.reset(); this.post({ type: 'clear' }); this.entries = []; }
    if (command === 'model') {
      if (this.backend === 'chatgpt' && !this.models.some(m => m.slug === value)) throw new Error('Modelo não disponível para esta conexão.');
      if (this.backend === 'chatgpt') this.model = value; else this.codexModel = value;
      this.agents[this.backend]?.reset(); delete this.agents[this.backend];
    }
    if (command === 'reset') { this.agents[this.backend]?.reset(); this.entries = []; this.post({ type: 'clear' }); }
    if (command === 'folder') await vscode.commands.executeCommand('workbench.action.files.openFolder');
    if (command === 'terminal') await vscode.commands.executeCommand('workbench.action.terminal.toggleTerminal');
    if (command === 'git') await vscode.commands.executeCommand('workbench.view.scm');
    if (command === 'explorer') await vscode.commands.executeCommand('workbench.view.explorer');
    if (command === 'file') {
      await this.selectWorkspace();
      const result = this.workspace.readFile(value, { track: false });
      await vscode.window.showTextDocument(vscode.Uri.file(path.join(this.workspace.root, result.path)));
    }
    if (command === 'models' && this.backend === 'chatgpt') await this.loadModels();
    if (command === 'login' || command === 'logout') {
      if (this.backend === 'codex') {
        const executable = codexPath();
        const terminal = vscode.window.createTerminal({ name: 'ChatAgente · Codex', shellPath: executable,
          shellArgs: [command === 'login' ? 'login' : 'logout'],
          cwd: this.workspace?.root || this.context.globalStorageUri.fsPath });
        terminal.show(); this.agents.codex?.reset();
      } else if (command === 'login') {
        this.loginController = new AbortController(); this.state();
        try { await this.auth.signIn(this.loginController.signal); await this.loadModels(); }
        finally { this.loginController = null; this.agents = {}; this.state(); }
      } else {
        const result = await this.auth.disconnect(); this.models = []; this.model = ''; this.agents = {};
        if (result.warning) this.entry({ type: 'error', text: result.warning });
      }
    }
    this.state();
  }
  resolveWebviewView(view) {
    this.view = view;
    const webview = view.webview;
    const media = vscode.Uri.joinPath(this.context.extensionUri, 'media');
    webview.options = { enableScripts: true, localResourceRoots: [media] };
    const nonce = crypto.randomBytes(24).toString('base64');
    webview.html = fs.readFileSync(path.join(this.context.extensionPath, 'media', 'index.html'), 'utf8')
      .replaceAll('{{csp}}', webview.cspSource).replaceAll('{{nonce}}', nonce)
      .replaceAll('{{script}}', webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.js')).toString())
      .replaceAll('{{style}}', webview.asWebviewUri(vscode.Uri.joinPath(media, 'chat.css')).toString());
    view.onDidDispose(() => { if (this.view === view) this.view = null; }, null, this.context.subscriptions);
    webview.onDidReceiveMessage(message => {
      void this.handle(message).catch(error => { this.entry({ type: 'error', text: this.error(error) }); this.state(); });
    }, null, this.context.subscriptions);
  }
  dispose() { this.controller?.abort(); this.loginController?.abort(); this.statusBar.dispose(); }
}

async function activate(context) {
  try {
    const runtime = { ...require('./runtime/agent.cjs'), ...require('./runtime/workspace.cjs'), ...require('./runtime/codex-agent.cjs') };
    const { ChatGPTAuth } = require('./runtime/chatgpt-auth.cjs');
    const auth = await createProfileAuth(ChatGPTAuth, { directory: context.globalStorageUri.fsPath, openBrowser: async value => {
      if (new URL(value).origin !== 'https://auth.openai.com') throw new Error('Destino OAuth bloqueado.');
      if (!await vscode.env.openExternal(vscode.Uri.parse(value))) throw new Error('Não foi possível abrir o navegador.');
    } }, context.secrets, createSafeStorage);
    const provider = new ChatView(context, runtime, auth);
    provider.state();
    context.subscriptions.push(provider, vscode.window.registerWebviewViewProvider('chatagente.chat', provider),
      vscode.commands.registerCommand('chatagente.open', () => vscode.commands.executeCommand('chatagente.chat.focus')),
      vscode.commands.registerCommand('chatagente.selectAgent', value => provider.selectAgent(value)),
      vscode.workspace.onDidChangeWorkspaceFolders(() => { provider.controller?.abort(); provider.workspace = null; provider.agents = {}; provider.state(); }));
    if (auth.status().sharing) { try { await provider.loadModels(); } catch { /* Login permanece disponível para recuperar a conexão. */ } }
    if (!context.globalState.get('chatagente.opened')) {
      await vscode.commands.executeCommand('chatagente.open');
      await context.globalState.update('chatagente.opened', true);
    }
    return Object.freeze({ getState: () => provider.getState() });
  } catch (error) { void vscode.window.showErrorMessage(`ChatAgente: falha ao iniciar. ${safeError(error)}`); }
}
module.exports = { activate, ChatView, codexPath };
