
const { exec } = require('child_process');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {PythonShell} = require('python-shell')
const fs = require('fs');

const loadingQueue = [];
const loadedBooks = [];
let mainWindow;

app.whenReady().then(() => {
    mainWindow = createWindow();
    mainWindow.webContents.openDevTools()

    const homedir = require('os').homedir();
    let logPath = path.join(homedir,'/electro-baudis-books/')
    let filename = 'book-list.json';

    fs.mkdir(logPath, { recursive: true }, (err) => {//Make dir if not exist
        if (err) throw err;
      });

    try{
        fs.readFile(logPath + filename, 'utf8' , (err, data) => {
            if (err) {
              console.error(err)
              return
            }
            Array.prototype.push.apply(loadedBooks,  JSON.parse(data) );
        });
    }catch(e){}
   
    RendererHandlerAPI.build();
    PyAPI.build();

    app.on('activate', () => {
        if(BrowserWindow.getAllWindows === 0) createWindow();
    })   
    app.on('window-all-closed', () => {
        //Save loadedBooks list
         fs.writeFile(logPath + filename, JSON.stringify(loadedBooks), err => {
            if (err) {
              console.error(err)
              return
            }
            //file written successfully
            if (process.platform !== 'darwin') app.quit();
          })
    })

})

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        }
    });
    win.loadFile('src/html/index.html');
    return win;
}

class PyAPI{
    static script;

    static build(){
        let scriptPath = path.join(__dirname,'../python/','scraper.py');
        PyAPI.script = new PythonShell(scriptPath);

        //Script listener
        PyAPI.script.on('message', function (message) {
            let result = JSON.parse(message);
            switch(result.typeMessage){
                case 'search':
                    PythonHandlerAPI.search(result);
                    break;
                case 'downloaded':
                    PythonHandlerAPI.downloaded(result);
                    break;
                case 'loading':
                    PythonHandlerAPI.loading(result);
                    break;
                case 'error':
                    PythonHandlerAPI.error(result);
                    break;
                default:
                    break;
            }
        });

        PyAPI.script.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
          });
    }

    static async send(objectMessage){
        await PyAPI.script.send( JSON.stringify(objectMessage) );
    }
}

class PythonHandlerAPI{
    
    static search(message){
        let searchList = message.books;
        let pageCount = message.pageCount;
        let currentPage = message.currentPage;
       
        let includedLoadedBooks = [];
        //Sort unloadedBooks and loaded books from searchList
        let unloadedBooks = searchList.filter(newBook => {
            let ind = loadedBooks.findIndex(oldBook => { return oldBook.link === newBook.link});
            if(ind != -1 && loadedBooks[ind].path ){ 
                includedLoadedBooks.push(loadedBooks[ind])
                return false;
            }else return true;
        })
        let answer = {
            books: includedLoadedBooks.concat(unloadedBooks),
            pageCount:  pageCount,
            currentPage:  currentPage
        }
        
        RendererHandlerAPI.send('search', answer);
    }

    static downloaded(message){
        //Find dowloaded book in loadingQueue and add this book in loadedBooks, and then remove from loadingQueue 
        let ind = loadingQueue.findIndex(book => book.link == message.link);
        if(ind != -1){
            loadingQueue[ind].path = message.path;
            loadingQueue[ind].loaded = true;
            loadedBooks.push(loadingQueue.splice(ind,1)[0]);
            RendererHandlerAPI.send('downloaded', message.link);
        }else console.log(message);
        
    }

    static loading(message){
        let answer = {
            link: message.link,
            percent: message.percent
        }
        RendererHandlerAPI.send('loading', answer);
    }

    static error(message){
        console.log(message);
    }
}

class RendererHandlerAPI{

    static build(){
        ipcMain.handle('search', RendererHandlerAPI.search);
        ipcMain.handle('download', RendererHandlerAPI.download);
        ipcMain.handle('delete', RendererHandlerAPI.delete);
        ipcMain.handle('play', RendererHandlerAPI.play);
        ipcMain.handle('getloadedBooks', RendererHandlerAPI.getloadedBooks);
    }

    static send(channel,message){
        mainWindow.webContents.send(channel, message);
    }

    static async search(e, searchStr, pageNum){
        
        let messageObject = {
            'typeMessage': 'search',
            'searchStr': searchStr,
            'pageNum': pageNum
        };    
        PyAPI.send(messageObject);
        return null;
    }

    static download(e, book){
        let messageObject = {
            'typeMessage': 'download',
            'link': book.link
        };
        loadingQueue.push(book);
        PyAPI.send(messageObject);
        return null;
    }

    static async delete(e, link){
        let targetInd = loadedBooks.findIndex( book => {return link == book.link});
        let target = loadedBooks[targetInd];
        if(targetInd == -1)throw new Exception('Path not found');
        
        fs.unlink(target.path, (err) => { //File removing
            if (err) throw err;
        });
        mainWindow.webContents.send('delete', link);
        return loadedBooks.splice(targetInd,1)[0]; 
    }

    static play(e, link){
        let target = loadedBooks.find( book => book.link == link);       
        if(!target) throw new Exception('File not found');
        exec(target.path);
    }

    static getloadedBooks(e, filterStr){         
        let result = loadedBooks.filter( book =>{
                return book.title.includes(filterStr) && book.link != undefined         
            });
        mainWindow.webContents.send('getloadedBooks', result);
    }
}

