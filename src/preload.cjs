const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatAgente', {
  info: () => ipcRenderer.invoke('app:info'),
  selectBackend: backend => ipcRenderer.invoke('agent:backend', backend),
  models: () => ipcRenderer.invoke('agent:models'),
  setModel: model => ipcRenderer.invoke('agent:model', model),
  signIn: () => ipcRenderer.invoke('chatgpt:signin'),
  disconnect: () => ipcRenderer.invoke('chatgpt:disconnect'),
  openUsage: () => ipcRenderer.invoke('chatgpt:usage'),
  chooseProject: () => ipcRenderer.invoke('project:choose'),
  listDirectory: request => ipcRenderer.invoke('project:list', request),
  projectChanges: request => ipcRenderer.invoke('project:changes', request),
  readProjectFile: request => ipcRenderer.invoke('project:read', request),
  send: prompt => ipcRenderer.invoke('agent:send', prompt),
  stop: () => ipcRenderer.invoke('agent:stop'),
  reset: () => ipcRenderer.invoke('chat:reset'),
  terminal: command => ipcRenderer.invoke('terminal:run', command),
  stopTerminal: () => ipcRenderer.invoke('terminal:stop'),
  gitStatus: () => ipcRenderer.invoke('git:status'),
  gitDiff: () => ipcRenderer.invoke('git:diff'),
  onEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },
});
