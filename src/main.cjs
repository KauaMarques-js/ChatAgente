const path = require('node:path');
const { pathToFileURL } = require('node:url');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { app, BrowserWindow, ipcMain, dialog, session, safeStorage, shell } = require('electron');
const OpenAI = require('openai');
const { Workspace } = require('./workspace.cjs');
const { Agent } = require('./agent.cjs');
const { CodexAgent } = require('./codex-agent.cjs');
const { ChatGPTAuth } = require('./chatgpt-auth.cjs');

let window;
let workspace;
let agents;
let auth;
let authError = '';
let backend = 'chatgpt';
let model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
let activeController;
let terminalController;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });

function notify(event) {
  if (window && !window.isDestroyed()) window.webContents.send('agent:event', event);
}

function info() {
  return {
    directory: workspace.root,
    apiConfigured: false,
    chatgpt: auth?.status() || { connected: false, sharing: false },
    authError, backend, model,
  };
}

function makeAgents() {
  const usePlan = auth?.status().sharing;
  agents = {
    chatgpt: new Agent({
      workspace, model,
      sharing: usePlan,
      ...(usePlan ? { clientFactory: async () => {
        const token = await auth.accessToken();
        return new OpenAI({ apiKey: token, baseURL: 'https://api.openai.com/v1', logLevel: 'warn',
          organization: null, project: null, maxRetries: 0, fetchOptions: { redirect: 'error' },
          defaultHeaders: { authorization: `Bearer ${token}`, 'openai-organization': null, 'openai-project': null } });
      } } : {}),
      onEvent: notify, approve: approveAction,
    }),
    codex: new CodexAgent({ workspace, onEvent: notify,
      ...(app.isPackaged ? { sdkModule: pathToFileURL(path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@openai', 'codex-sdk', 'dist', 'index.js')).href } : {}),
    }),
  };
}

async function approveAction(name, args) {
  if (!window || window.isDestroyed() || activeController?.signal.aborted) return false;
  const command = name === 'run_command';
  const title = command ? 'Permitir comando PowerShell?' : 'Permitir alteração no arquivo?';
  const detail = command
    ? `Comando (pode acessar arquivos fora do projeto e a rede):\n\n${args.command}`
    : `Arquivo: ${args.path}\nTamanho: ${args.bytes} bytes\n\nPrévia:\n${args.preview}`;
  const answer = await dialog.showMessageBox(window, {
    type: 'warning', title, message: title, detail: detail.slice(0, 3_200),
    buttons: ['Permitir uma vez', 'Negar'], defaultId: 1, cancelId: 1, noLink: true,
  });
  return answer.response === 0 && !activeController?.signal.aborted;
}

function createWindow() {
  window = new BrowserWindow({
    title: 'ChatAgente', width: 1260, height: 800, minWidth: 810, minHeight: 560,
    backgroundColor: '#0c101a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  workspace = new Workspace(app.isPackaged ? app.getPath('documents') : process.cwd());
  auth = new ChatGPTAuth({ directory: app.getPath('userData'), safeStorage,
    openBrowser: async url => {
      if (new URL(url).origin !== 'https://auth.openai.com') throw new Error('Destino de autenticação inválido.');
      await shell.openExternal(url);
    } });
  try { await auth.initialize(); } catch (error) { authError = error.message; }
  makeAgents();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => {
  activeController?.abort();
  terminalController?.abort();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:info', () => info());
function explorerWorkspace(request) {
  if (request?.directory !== workspace.root) throw new Error('O projeto mudou. Atualize o explorador.');
  return workspace;
}
ipcMain.handle('project:list', (_event, request) => explorerWorkspace(request).listDirectory(request.path));
ipcMain.handle('project:changes', (_event, request) => explorerWorkspace(request).gitChanges());
ipcMain.handle('project:read', (_event, request) => explorerWorkspace(request).readFile(request.path, { track: false }));
ipcMain.handle('project:choose', async () => {
  if (activeController || terminalController || auth?.signingIn) throw new Error('Interrompa a execução antes de trocar o projeto.');
  const selected = await dialog.showOpenDialog(window, {
    title: 'Selecione a pasta do projeto', properties: ['openDirectory'],
  });
  if (!selected.canceled && selected.filePaths[0]) {
    workspace = new Workspace(selected.filePaths[0]);
    makeAgents();
    notify({ type: 'project', directory: workspace.root });
  }
  return info();
});

ipcMain.handle('chat:reset', () => {
  if (activeController) throw new Error('Interrompa a tarefa antes de limpar o contexto.');
  agents?.[backend]?.reset();
  return true;
});

ipcMain.handle('agent:backend', (_event, selected) => {
  if (activeController || terminalController || auth?.signingIn) throw new Error('Termine a execução para trocar de agente.');
  if (!['chatgpt', 'codex'].includes(selected)) throw new Error('Agente inválido.');
  backend = selected;
  agents[selected]?.reset();
  return info();
});

ipcMain.handle('agent:models', async () => {
  if (auth?.status().sharing) return auth.models();
  const configured = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  return [{ slug: configured, name: configured }];
});

ipcMain.handle('agent:model', (_event, selected) => {
  if (activeController || terminalController) throw new Error('Finalize a execução para trocar o modelo.');
  if (typeof selected !== 'string' || !/^[\w./:-]{2,200}$/.test(selected)) throw new Error('Modelo inválido.');
  model = selected;
  agents.chatgpt.model = selected;
  agents.chatgpt.reset();
  return info();
});

ipcMain.handle('chatgpt:signin', async () => {
  if (activeController || terminalController) throw new Error('Interrompa a execução para conectar uma conta.');
  if (authError) throw new Error(authError);
  const controller = new AbortController();
  activeController = controller;
  try {
    const result = await auth.signIn(controller.signal);
    makeAgents();
    if (result.sharing) {
      const models = await auth.models();
      if (models.length) model = models[0].slug;
    }
    makeAgents();
    return info();
  } finally {
    if (activeController === controller) activeController = null;
  }
});

ipcMain.handle('chatgpt:disconnect', async () => {
  if (activeController || terminalController) throw new Error('Finalize a tarefa antes de desconectar.');
  const disconnected = await auth.disconnect();
  model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  makeAgents();
  return { ...info(), warning: disconnected.warning };
});

ipcMain.handle('chatgpt:usage', async () => shell.openExternal('https://chatgpt.com/settings/usage'));

ipcMain.handle('agent:send', async (_event, prompt) => {
  if (activeController || terminalController) throw new Error('Já há uma execução em andamento.');
  if (auth?.signingIn) throw new Error('Conclua o login ChatGPT antes de enviar uma tarefa.');
  if (backend === 'chatgpt' && !auth?.status().sharing) {
    throw new Error('Continue com ChatGPT e autorize o uso do plano. Não é necessária API key.');
  }
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 15_000) throw new Error('Mensagem inválida (máximo 15.000 caracteres).');
  const controller = new AbortController();
  activeController = controller;
  try {
    if (backend === 'codex') {
    const choice = await dialog.showMessageBox(window, { type: 'warning', title: 'Permitir execução Codex?',
      message: 'Permitir que Codex execute comandos e altere arquivos neste projeto?',
      detail: `Pasta: ${workspace.root}\nO Codex usa workspace-write e não solicita aprovação individual para cada alteração nesta tarefa.`,
      buttons: ['Permitir tarefa', 'Cancelar'], defaultId: 1, cancelId: 1, noLink: true });
    if (choice.response !== 0) throw new Error('Tarefa Codex cancelada.');
    }
    controller.signal.throwIfAborted();
    const result = await agents[backend].send(prompt, controller.signal);
    notify({ type: 'done', text: result });
    return result;
  }
  finally { if (activeController === controller) activeController = null; }
});

ipcMain.handle('agent:stop', () => {
  activeController?.abort();
  terminalController?.abort();
  return true;
});

ipcMain.handle('terminal:run', async (_event, command) => {
  if (activeController || terminalController) throw new Error('Já há uma execução em andamento.');
  const controller = new AbortController();
  terminalController = controller;
  try {
    return await workspace.command(command, controller.signal, {
      timeout: 0,
      onOutput: text => notify({ type: 'terminal-output', text }),
    });
  }
  finally { if (terminalController === controller) terminalController = null; }
});

ipcMain.handle('terminal:stop', () => {
  terminalController?.abort();
  return true;
});

ipcMain.handle('git:status', async () => workspace.gitStatus());
ipcMain.handle('git:diff', async () => workspace.gitDiff());
