const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('baudisAPI',{
  search: (searchStr,pageNum = 1) => ipcRenderer.invoke('search', searchStr, pageNum),
  download: (book) => ipcRenderer.invoke('download', book),
  delete: (link) => ipcRenderer.invoke('delete', link),
  play: (link) => ipcRenderer.invoke('play', link),
  getloadedBooks: (filterStr = '') => ipcRenderer.invoke('getloadedBooks', filterStr = ''),
})

contextBridge.exposeInMainWorld('rendererAPI',{
  search: (callback) => ipcRenderer.on('search', callback),
  downloaded: (callback) => ipcRenderer.on('downloaded', callback),
  loading: (callback) => ipcRenderer.on('loading', callback),
  delete: (callback) => ipcRenderer.on('delete', callback),
  play: (callback) => ipcRenderer.on('play', callback),
  getloadedBooks: (callback) => ipcRenderer.on('getloadedBooks', callback),
})