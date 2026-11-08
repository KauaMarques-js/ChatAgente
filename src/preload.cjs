const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('chatAgente', {
  info: () => ipcRenderer.invoke('app:info'),
  chooseProject: () => ipcRenderer.invoke('project:choose'),
  send: prompt => ipcRenderer.invoke('agent:send', prompt),
  stop: () => ipcRenderer.invoke('agent:stop'),
  reset: () => ipcRenderer.invoke('chat:reset'),
  terminal: command => ipcRenderer.invoke('terminal:run', command),
  gitStatus: () => ipcRenderer.invoke('git:status'),
  gitDiff: () => ipcRenderer.invoke('git:diff'),
  onEvent: callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('agent:event', listener);
    return () => ipcRenderer.removeListener('agent:event', listener);
  },
});
