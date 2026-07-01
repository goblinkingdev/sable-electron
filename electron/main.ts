import { app, BrowserWindow, shell, Menu, dialog, session, desktopCapturer, nativeImage } from "electron";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { createReadStream, existsSync, statSync } from "fs";
import { join, extname, normalize } from "path";
import { AddressInfo } from "net";
import { autoUpdater, UpdateInfo, ProgressInfo } from "electron-updater";

// Disable cross-origin isolation enforcement at the Chromium level
app.commandLine.appendSwitch("disable-features", "CrossOriginEmbedderPolicy,CrossOriginOpenerPolicy,CrossOriginResourcePolicy");
app.commandLine.appendSwitch("disable-site-isolation-trials");

const SABLE_DIST = (() => {
  if (app.isPackaged) return join(process.resourcesPath, "sable-dist");
  const nixDist = join(__dirname, "..", "dist");
  const devDist = join(__dirname, "..", "sable", "dist");
  return require("fs").existsSync(join(nixDist, "index.html"))
    ? nixDist
    : devDist;
})();

const APP_ICON = (() => {
  if (app.isPackaged) return join(process.resourcesPath, "resources", "icon.png");
  return join(__dirname, "..", "resources", "icon.png");
})();

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.allowDowngrade = false;

async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    console.log("[auto-updater] Skipping update check in development mode");
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error("[auto-updater] Update check failed:", error);
  }
}

function setupPeriodicUpdateChecks(): void {
  const CHECK_INTERVAL = 12 * 60 * 60 * 1000;
  setInterval(() => {
    if (app.isPackaged) checkForUpdates();
  }, CHECK_INTERVAL);
}

function setupAutoUpdaterEvents(mainWindow: BrowserWindow): void {
  autoUpdater.on("checking-for-update", () => {
    console.log("[auto-updater] Checking for updates...");
  });
  autoUpdater.on("update-available", (info: UpdateInfo) => {
    console.log(`[auto-updater] Update available: ${info.version}`);
  });
  autoUpdater.on("update-not-available", (info: UpdateInfo) => {
    console.log(`[auto-updater] Update not available, current version: ${info.version}`);
  });
  autoUpdater.on("download-progress", (progressObj: ProgressInfo) => {
    console.log(`[auto-updater] Download progress: ${progressObj.percent.toFixed(1)}%`);
  });
  autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
    console.log(`[auto-updater] Update downloaded: ${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update Available",
      message: "A new version of Sable has been downloaded. Restart the application to install.",
      detail: `Version ${info.version} is ready to install.`,
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on("error", (error: Error) => {
    console.error("[auto-updater] Update error:", error);
  });
}

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
  const safePath = normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = join(SABLE_DIST, safePath);

  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  }
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
      "Service-Worker-Allowed": "/",
      "Permissions-Policy":
        "camera=*, microphone=*, display-capture=*, speaker-selection=*, autoplay=*, fullscreen=*",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500);
    res.end("Internal error");
  }
}

const WIDGET_PERMISSIONS = [
  "media",
  "display-capture",
  "mediaKeySystem",
  "clipboard-sanitized-write",
  "clipboard-read",
  "notifications",
  "fullscreen",
];

function setupWidgetSupport(): void {
  session.defaultSession.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(WIDGET_PERMISSIONS.includes(permission));
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (_webContents, permission) => WIDGET_PERMISSIONS.includes(permission)
  );

  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
        });
        callback({ video: sources[0], audio: "loopback" });
      } catch {
        callback({});
      }
    },
    { useSystemPicker: true }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["https://*/*", "http://*/*"] },
    (details, callback) => {
      const responseHeaders: Record<string, string[]> = {
        ...(details.responseHeaders ?? {}),
      };

      const isLocalhost = details.url.startsWith("http://localhost") || details.url.startsWith("http://127.0.0.1");
      const isElementCall = details.url.includes("call.element.io");
      const shouldLog = isLocalhost || isElementCall;

      if (shouldLog) {
        console.log(`\n[headers] === Intercepted ${isLocalhost ? "LOCALHOST" : "ELEMENT CALL"} response ===`);
        console.log(`[headers] URL: ${details.url.substring(0, 150)}`);
        console.log(`[headers] Status: ${details.statusCode}`);
        console.log(`[headers] Original headers:`);
        for (const [key, value] of Object.entries(details.responseHeaders ?? {})) {
          console.log(`[headers]   ${key}: ${value.join(", ")}`);
        }
      }

      const headersToDelete = [
        "x-frame-options",
        "cross-origin-opener-policy",
        "cross-origin-embedder-policy",
        "cross-origin-resource-policy",
        "cross-origin-opener-policy-report-only",
        "cross-origin-embedder-policy-report-only",
      ];

      for (const key of [...Object.keys(responseHeaders)]) {
        const lower = key.toLowerCase();

        if (headersToDelete.includes(lower)) {
          if (shouldLog) {
            console.log(`[headers] STRIPPING: ${key}: ${responseHeaders[key]}`);
          }
          delete responseHeaders[key];
          continue;
        }

        if (
          lower === "content-security-policy" ||
          lower === "content-security-policy-report-only"
        ) {
          if (shouldLog) {
            console.log(`[headers] MODIFYING CSP: ${responseHeaders[key]}`);
          }
          responseHeaders[key] = responseHeaders[key].map((v) =>
            v
              .replace(/frame-ancestors\s+[^;]*(;|$)/gi, "frame-ancestors * $1")
              .replace(/frame-src\s+[^;]*(;|$)/gi, "frame-src * $1")
              .replace(/child-src\s+[^;]*(;|$)/gi, "child-src * $1")
              .replace(/require-corp\s*(;|$)/gi, "$1")
          );
          if (shouldLog) {
            console.log(`[headers] CSP after: ${responseHeaders[key]}`);
          }
        }
      }

      if (shouldLog) {
        console.log(`[headers] === Final headers ===`);
        for (const [key, value] of Object.entries(responseHeaders)) {
          console.log(`[headers]   ${key}: ${value.join(", ")}`);
        }
        console.log();
      }

      callback({ responseHeaders });
    }
  );
}

let mainWindow: BrowserWindow | null = null;

function createWindow(port: number): void {
  const iconPath = existsSync(APP_ICON) ? APP_ICON : undefined;

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: "Sable",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      allowRunningInsecureContent: false,
      webSecurity: true,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  // Set macOS dock icon
  if (process.platform === "darwin" && iconPath) {
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
  }

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDesc, validatedURL) => {
    console.log(`\n[load-fail] Error ${errorCode}: ${errorDesc}`);
    console.log(`[load-fail] URL: ${validatedURL}\n`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`http://localhost:${port}`)) {
      return { action: "allow" };
    }
    try {
      const { protocol } = new URL(url);
      if (protocol === "https:" || protocol === "http:") {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 800,
            height: 700,
            webPreferences: { nodeIntegration: false, contextIsolation: true },
          },
        };
      }
    } catch {
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Clear cached storage data that might persist COEP/COOP state
  await session.defaultSession.clearStorageData({
    storages: ["serviceworkers", "cachestorage"],
  });
  console.log("[sable-desktop] Cleared service workers and cache storage");

  setupWidgetSupport();
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
  if (mainWindow) {
    setupAutoUpdaterEvents(mainWindow);
    checkForUpdates();
    setupPeriodicUpdateChecks();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
