/**
 * Renderer-side access to the Electron host (dialogs, files, window). The
 * preload script exposes `window.folio`; when the UI runs in a plain browser
 * (Vite dev server without Electron) the functions degrade gracefully.
 */
import type { FolioHost } from "../../electron/preload";

declare global {
  interface Window {
    folio?: FolioHost;
  }
}

const host = (): FolioHost | undefined => window.folio;
/** False when the UI runs in a plain browser (Vite dev server without Electron). */
export const isHosted = !!window.folio;

export const PDF_FILTER = [{ name: "PDF Document", extensions: ["pdf"] }];
export const IMAGE_FILTER = [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }];

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return i >= 0 ? path.slice(0, i) : "";
}

export function stripExt(name: string): string {
  return name.replace(/\.[^.]+$/, "");
}

export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir.endsWith(sep) ? dir + name : dir + sep + name;
}

/* ---------- dialogs ---------- */

export async function pickPdfs(multiple = true): Promise<string[]> {
  const r = await host()?.openDialog({ multiple, filters: PDF_FILTER, title: "Open PDF" });
  return r ?? [];
}

export async function pickImages(): Promise<string[]> {
  const r = await host()?.openDialog({ multiple: true, filters: IMAGE_FILTER, title: "Select images" });
  return r ?? [];
}

export async function pickFolder(title = "Select folder"): Promise<string | null> {
  const r = await host()?.openDialog({ directory: true, title });
  return r?.[0] ?? null;
}

export async function pickSavePath(defaultPath: string, filters = PDF_FILTER): Promise<string | null> {
  return (await host()?.saveDialog({ defaultPath, filters, title: "Save as" })) ?? null;
}

export async function confirmDialog(text: string, title = "Adobe PDF"): Promise<boolean> {
  const h = host();
  return h ? h.ask(text, title) : window.confirm(text);
}

export async function errorDialog(text: string, title = "Adobe PDF"): Promise<void> {
  const h = host();
  if (h) await h.message(text, title);
  else window.alert(text);
}

/* ---------- files ---------- */

export async function readBytes(path: string): Promise<Uint8Array> {
  const h = host();
  if (!h) {
    // Plain-browser development (Vite only): serve project files through /@fs/.
    const res = await fetch("/@fs/" + path.replace(/\\/g, "/"));
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return h.readFile(path);
}

export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  const h = host();
  if (!h) throw new Error("Saving needs the desktop app");
  await h.writeFile(path, bytes);
}

export async function ensureDir(path: string): Promise<void> {
  const h = host();
  if (h && !(await h.exists(path))) await h.mkdir(path);
}

/* ---------- lifecycle ---------- */

export async function launchArgs(): Promise<string[]> {
  try {
    return (await host()?.launchArgs()) ?? [];
  } catch {
    return [];
  }
}

/** Files handed over by the OS (double-click, "Open with", second launch). */
export function onOpenFiles(cb: (paths: string[]) => void): () => void {
  return host()?.onOpenFiles(cb) ?? (() => {});
}

/** Files dragged from the desktop onto the window. */
export function onFileDrop(cb: (paths: string[]) => void, onHover?: (hovering: boolean) => void): () => void {
  const h = host();
  if (!h) return () => {};
  let depth = 0;
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const enter = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (depth++ === 0) onHover?.(true);
  };
  const over = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const leave = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    if (--depth <= 0) {
      depth = 0;
      onHover?.(false);
    }
  };
  const drop = (e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    onHover?.(false);
    const paths = Array.from(e.dataTransfer?.files ?? [])
      .map((f) => h.pathForFile(f))
      .filter(Boolean);
    if (paths.length) cb(paths);
  };
  window.addEventListener("dragenter", enter);
  window.addEventListener("dragover", over);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", drop);
  return () => {
    window.removeEventListener("dragenter", enter);
    window.removeEventListener("dragover", over);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
  };
}

export function setWindowTitle(title: string): void {
  document.title = title;
  host()?.setTitle(title);
}

export function closeWindow(): void {
  const h = host();
  if (h) h.close();
  else window.close();
}

/* ---------- custom title bar ---------- */

export function minimizeWindow(): void {
  host()?.minimize();
}

export function toggleMaximizeWindow(): void {
  host()?.toggleMaximize();
}

/** Whether the OS draws the title bar (then the in-app window buttons are hidden). */
export async function windowIsDecorated(): Promise<boolean> {
  const h = host();
  if (!h) return true;
  return !(await h.isFrameless());
}

/** Track the maximized state; returns an unsubscribe function. */
export function onMaximizedChange(cb: (maximized: boolean) => void): () => void {
  const h = host();
  if (!h) return () => {};
  h.isMaximized().then(cb).catch(() => {});
  return h.onMaximizedChange(cb);
}

/**
 * Ask before the window closes (or the app quits) with unsaved work. The host
 * holds the close until `shouldClose` resolves. Returns an unsubscribe function.
 */
export function onCloseRequested(shouldClose: () => Promise<boolean>): () => void {
  const h = host();
  if (!h) return () => {};
  return h.onCloseRequested(async () => {
    let allow = true;
    try {
      allow = await shouldClose();
    } catch {
      allow = true;
    }
    h.closeDecision(allow);
  });
}
