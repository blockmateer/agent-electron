import { contextBridge, ipcRenderer, webUtils } from "electron";

export interface FileFilter {
  name: string;
  extensions: string[];
}

/** The host API exposed to the renderer as `window.folio`. */
export interface FolioHost {
  platform: string;
  openDialog(opts: { multiple?: boolean; directory?: boolean; filters?: FileFilter[]; title?: string }): Promise<string[] | null>;
  saveDialog(opts: { defaultPath?: string; filters?: FileFilter[]; title?: string }): Promise<string | null>;
  ask(text: string, title: string): Promise<boolean>;
  message(text: string, title: string): Promise<void>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  launchArgs(): Promise<string[]>;
  onOpenFiles(cb: (paths: string[]) => void): () => void;
  onCloseRequested(cb: () => void): () => void;
  closeDecision(allow: boolean): void;
  setTitle(title: string): void;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  isFrameless(): Promise<boolean>;
  onMaximizedChange(cb: (maximized: boolean) => void): () => void;
  pathForFile(file: File): string;
}

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const host: FolioHost = {
  platform: process.platform,
  openDialog: (opts) => ipcRenderer.invoke("dialog:open", opts),
  saveDialog: (opts) => ipcRenderer.invoke("dialog:save", opts),
  ask: (text, title) => ipcRenderer.invoke("dialog:ask", text, title),
  message: (text, title) => ipcRenderer.invoke("dialog:message", text, title),
  readFile: (p) => ipcRenderer.invoke("fs:read", p),
  writeFile: (p, data) => ipcRenderer.invoke("fs:write", p, data),
  mkdir: (p) => ipcRenderer.invoke("fs:mkdir", p),
  exists: (p) => ipcRenderer.invoke("fs:exists", p),
  launchArgs: () => ipcRenderer.invoke("launch-args"),
  onOpenFiles: (cb) => subscribe<string[]>("open-files", cb),
  onCloseRequested: (cb) => subscribe<void>("close-requested", () => cb()),
  closeDecision: (allow) => ipcRenderer.send("close-decision", allow),
  setTitle: (title) => ipcRenderer.send("window:set-title", title),
  minimize: () => ipcRenderer.send("window:minimize"),
  toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
  close: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized"),
  isFrameless: () => ipcRenderer.invoke("window:is-frameless"),
  onMaximizedChange: (cb) => subscribe<boolean>("maximized-changed", cb),
  pathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld("folio", host);
