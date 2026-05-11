import { app, BrowserWindow, shell, Menu } from "electron";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname, normalize } from "path";
import { AddressInfo } from "net";

const SABLE_DIST = (() => {
  if (app.isPackaged) return join(process.resourcesPath, "sable-dist");
  // nix build: dist/ sits next to dist-electron/
  const nixDist = join(__dirname, "..", "dist");
  const devDist = join(__dirname, "..", "sable", "dist");
  return require("fs").existsSync(join(nixDist, "index.html"))
    ? nixDist
    : devDist;
})();

// ---------------------------------------------------------------------------
// Minimal static file server
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".xml": "application/xml",
  ".txt": "text/plain",
  ".map": "application/json",
};

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  const urlPath = req.url?.split("?")[0] ?? "/";
  // Prevent path traversal
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(SABLE_DIST, safePath);

  // Directory → try index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }

  // File not found → SPA fallback (index.html)
  if (!existsSync(filePath)) {
    filePath = join(SABLE_DIST, "index.html");
  }

  const mime =
    MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";

  try {
    const stat = statSync(filePath);
    res.writeHead(200, {
      "Content-Type": mime,
      "Content-Length": stat.size,
      // Allow service worker to work on localhost
      "Service-Worker-Allowed": "/",
      // Needed for SharedArrayBuffer / Matrix crypto
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500);
    res.end("Internal error");
  }
}

// ---------------------------------------------------------------------------
// Start HTTP server, then create window
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;

function createWindow(port: number): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: "Sable",
    // Use a generic icon path; provide your own icon files under resources/
    // icon: join(__dirname, '../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
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
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  const server = createServer(serveStatic);

  server.listen(45781, "127.0.0.1", () => {
    const { port } = server.address() as AddressInfo;
    console.log(`[sable-desktop] serving on http://127.0.0.1:${port}`);
    Menu.setApplicationMenu(null);
    createWindow(port);
  });

  app.on("activate", () => {
    if (mainWindow === null) {
      const addr = server.address() as AddressInfo;
      createWindow(addr.port);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
