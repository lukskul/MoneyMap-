const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow = null;
let serverProcess = null;
let serverReady = false;
let quitting = false;
let startupBuffer = '';

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'public', 'coin.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, 'server.js');

  // PORT=0 asks the operating system for a free port, so each project
  // instance can start its own server without colliding with another one.
  serverProcess = spawn(process.env.NODE_BINARY || 'node', [serverPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: '0',
      MONEYMAP_DATA_DIR: path.join(__dirname, 'privateData')
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  serverProcess.stdout.setEncoding('utf8');
  serverProcess.stdout.on('data', chunk => {
    process.stdout.write(chunk);
    startupBuffer += chunk;

    const match = startupBuffer.match(/SERVER_READY:(\d+)/);
    if (match && !serverReady) {
      serverReady = true;
      createWindow(Number(match[1]));
    }

    // Keep the buffer small if startup messages continue without the marker.
    if (startupBuffer.length > 4096) {
      startupBuffer = startupBuffer.slice(-1024);
    }
  });

  serverProcess.stderr.setEncoding('utf8');
  serverProcess.stderr.on('data', chunk => process.stderr.write(chunk));

  serverProcess.on('error', error => {
    console.error('Could not launch the local server:', error);
    app.quit();
  });

  serverProcess.on('exit', (code, signal) => {
    if (!quitting && !serverReady) {
      console.error(`Local server exited before becoming ready (code=${code}, signal=${signal}).`);
      app.quit();
    } else if (!quitting && serverReady) {
      console.error('Local server stopped unexpectedly.');
      app.quit();
    }
  });
}

app.whenReady().then(startServer);

app.on('activate', () => {
  // macOS may reactivate the app after all windows have been closed.
  if (mainWindow === null && serverReady && serverProcess && !serverProcess.killed) {
    // Reloading the current local server is sufficient; it is still running.
    const match = startupBuffer.match(/SERVER_READY:(\d+)/);
    if (match) createWindow(Number(match[1]));
  }
});

app.on('before-quit', () => {
  quitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
