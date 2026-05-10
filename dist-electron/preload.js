"use strict";
/**
 * Preload script runs in a privileged context but exposes nothing to the
 * renderer by default.  contextIsolation=true keeps the renderer sandboxed.
 *
 * Add contextBridge.exposeInMainWorld() calls here if you need IPC later
 * (e.g. native notifications, file-save dialogs, tray integration).
 */
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('sableDesktop', {
    platform: process.platform,
    /** Signal main process to open native file-save dialog in the future */
    // saveFile: (data: Uint8Array, name: string) => ipcRenderer.invoke('save-file', data, name),
});
// Suppress "ipcRenderer imported but not used" until we add real IPC
void electron_1.ipcRenderer;
//# sourceMappingURL=preload.js.map