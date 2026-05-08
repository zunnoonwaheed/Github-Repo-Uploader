const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRecentFolders: () => ipcRenderer.invoke('get-recent-folders'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  uploadToGitHub: (opts) => ipcRenderer.invoke('upload-to-github', opts),
  checkAuth: () => ipcRenderer.invoke('check-auth'),
  githubLogin: () => ipcRenderer.invoke('github-login'),
  onLog: (callback) => {
    ipcRenderer.on('log', (_, data) => callback(data));
  },
  removeLogListener: () => {
    ipcRenderer.removeAllListeners('log');
  },
});
