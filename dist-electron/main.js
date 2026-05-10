"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const http_1 = require("http");
const fs_1 = require("fs");
const path_1 = require("path");
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
/**
 * In production (packaged), sable/dist is copied to resources/sable-dist by
 * electron-builder.  In development, it lives at ../../sable/dist relative to
 * this compiled file (dist-electron/main.js → project root → sable/dist).
 */
const SABLE_DIST = electron_1.app.isPackaged
    ? (0, path_1.join)(process.resourcesPath, 'sable-dist')
    : (0, path_1.join)(__dirname, '..', 'sable', 'dist');
// ---------------------------------------------------------------------------
// Minimal static file server
// ---------------------------------------------------------------------------
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.map': 'application/json',
};
function serveStatic(req, res) {
    const urlPath = req.url?.split('?')[0] ?? '/';
    // Prevent path traversal
    const safePath = (0, path_1.normalize)(urlPath).replace(/^(\.\.(\/|\\|$))+/, '');
    let filePath = (0, path_1.join)(SABLE_DIST, safePath);
    // Directory → try index.html
    if ((0, fs_1.existsSync)(filePath) && (0, fs_1.statSync)(filePath).isDirectory()) {
        filePath = (0, path_1.join)(filePath, 'index.html');
    }
    // File not found → SPA fallback (index.html)
    if (!(0, fs_1.existsSync)(filePath)) {
        filePath = (0, path_1.join)(SABLE_DIST, 'index.html');
    }
    const mime = MIME_TYPES[(0, path_1.extname)(filePath).toLowerCase()] ?? 'application/octet-stream';
    try {
        const stat = (0, fs_1.statSync)(filePath);
        res.writeHead(200, {
            'Content-Type': mime,
            'Content-Length': stat.size,
            // Allow service worker to work on localhost
            'Service-Worker-Allowed': '/',
            // Needed for SharedArrayBuffer / Matrix crypto
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        });
        (0, fs_1.createReadStream)(filePath).pipe(res);
    }
    catch {
        res.writeHead(500);
        res.end('Internal error');
    }
}
// ---------------------------------------------------------------------------
// Start HTTP server, then create window
// ---------------------------------------------------------------------------
let mainWindow = null;
function createWindow(port) {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 600,
        minHeight: 400,
        title: 'Sable',
        // Use a generic icon path; provide your own icon files under resources/
        // icon: join(__dirname, '../resources/icon.png'),
        webPreferences: {
            preload: (0, path_1.join)(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            // Allow service workers on localhost
            allowRunningInsecureContent: false,
            webSecurity: true,
        },
    });
    mainWindow.loadURL(`http://localhost:${port}`);
    // Open external links in the system browser, not in Electron
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (!url.startsWith(`http://localhost:${port}`)) {
            electron_1.shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function buildMenu(port) {
    const template = [
        {
            label: 'Sable',
            submenu: [
                { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
                { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => mainWindow?.webContents.reloadIgnoringCache() },
                { type: 'separator' },
                { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        { role: 'editMenu' },
        { role: 'viewMenu' },
        { role: 'windowMenu' },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'Sable on GitHub',
                    click: () => electron_1.shell.openExternal('https://github.com/SableClient/Sable'),
                },
                {
                    label: 'Sable Desktop on GitHub',
                    click: () => electron_1.shell.openExternal('https://github.com/YOUR_USERNAME/sable-desktop'),
                },
            ],
        },
    ];
    electron_1.Menu.setApplicationMenu(electron_1.Menu.buildFromTemplate(template));
    // suppress unused warning
    void port;
}
electron_1.app.whenReady().then(() => {
    const server = (0, http_1.createServer)(serveStatic);
    // Port 0 → OS picks a free port
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address();
        console.log(`[sable-desktop] serving on http://127.0.0.1:${port}`);
        buildMenu(port);
        createWindow(port);
    });
    electron_1.app.on('activate', () => {
        if (mainWindow === null) {
            const addr = server.address();
            createWindow(addr.port);
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
//# sourceMappingURL=main.js.map