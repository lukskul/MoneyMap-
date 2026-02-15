const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'public', 'coin.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 👇 Launch the Express server before Electron tries to connect
app.whenReady().then(() => {
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  setTimeout(() => {
    createWindow();
  }, 1000); // wait 1 second for server to be ready
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
