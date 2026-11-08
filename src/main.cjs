const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { app, BrowserWindow, ipcMain, dialog, session } = require('electron');
const { Workspace } = require('./workspace.cjs');
const { Agent } = require('./agent.cjs');

let window;
let workspace;
let agent;
let activeController;
let terminalController;

function notify(event) {
  if (window && !window.isDestroyed()) window.webContents.send('agent:event', event);
}

function info() {
  return {
    directory: workspace.root,
    apiConfigured: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
  };
}

function makeAgent() {
  agent = null;
  if (process.env.OPENAI_API_KEY) {
    agent = new Agent({
      workspace,
      apiKey: process.env.OPENAI_API_KEY,
      model: info().model,
      onEvent: notify,
      approve: approveAction,
    });
  }
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

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  workspace = new Workspace(process.cwd());
  makeAgent();
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => {
  activeController?.abort();
  terminalController?.abort();
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('app:info', () => info());
ipcMain.handle('project:choose', async () => {
  if (activeController || terminalController) throw new Error('Interrompa a execução antes de trocar o projeto.');
  const selected = await dialog.showOpenDialog(window, {
    title: 'Selecione a pasta do projeto', properties: ['openDirectory'],
  });
  if (!selected.canceled && selected.filePaths[0]) {
    workspace = new Workspace(selected.filePaths[0]);
    makeAgent();
    notify({ type: 'project', directory: workspace.root });
  }
  return info();
});

ipcMain.handle('chat:reset', () => {
  if (activeController) throw new Error('Interrompa a tarefa antes de limpar o contexto.');
  agent?.reset();
  return true;
});

ipcMain.handle('agent:send', async (_event, prompt) => {
  if (activeController || terminalController) throw new Error('Já há uma execução em andamento.');
  if (!agent) throw new Error('OPENAI_API_KEY ausente. Configure o arquivo .env e reinicie o aplicativo.');
  if (typeof prompt !== 'string' || prompt.length > 15_000) throw new Error('Mensagem inválida (máximo 15.000 caracteres).');
  const controller = new AbortController();
  activeController = controller;
  try { return await agent.send(prompt, controller.signal); }
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
  try { return await workspace.command(command, controller.signal); }
  finally { if (terminalController === controller) terminalController = null; }
});

ipcMain.handle('git:status', async () => workspace.gitStatus());
ipcMain.handle('git:diff', async () => workspace.gitDiff());
