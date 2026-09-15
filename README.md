# Adobe PDF (Electron edition)

A lightweight desktop PDF viewer and editor for Windows, macOS and Linux, in the spirit of
Acrobat's everyday features: view, comment, fill & sign, organize pages, combine and convert.

Built with **Electron** (Chromium on every platform, so rendering and editing behave the
same everywhere), **React + TypeScript**, **pdf.js** (rendering, text, forms, annotation
editing) and **pdf-lib** (page structure). The sibling `folio-pdf` project is the same app
on Tauri; only the host layer differs (`electron/` + `src/lib/host.ts`).

## Features

| Area | What you can do |
|---|---|
| View | Open (dialog, drag & drop, double-click `.pdf`, recent files), tabs, continuous scroll, zoom presets / Ctrl+wheel, fit page / width, rotate view, page thumbnails, bookmarks, find with per-page hits, text selection, print |
| Comment | Highlight (text or free-form), freehand pen, text boxes, sticky notes, images; undo / redo / delete |
| Fill & Sign | Fill AcroForm fields, add text, create a signature (draw / type / image with white knock-out) and place it as a movable, resizable stamp |
| Organize pages | Drag to reorder, multi-select, rotate, delete, extract to a new file, insert blank / PDF / images, split into files |
| Combine | Merge several PDFs into a new document |
| Export & convert | Pages → PNG/JPEG at 72/150/300 dpi, images → PDF, page numbers, watermark |
| Security | Opens password-protected PDFs; annotations and form values are saved back with the encryption intact |

Edits are written into the PDF itself when you save (Ctrl+S / Save as…). A dot on the
tab marks unsaved changes; closing a dirty tab or the window asks first.

### Layout

The shell follows current Acrobat: a custom title bar with **Menu**, **Home**, document
tabs and **Create**; a command bar with **All tools / Read / Edit / Convert / Sign**,
find, Print, Save and Fill & Sign; the **All tools** list (or the active tool's panel) on
the left; a floating quick-tool strip over the page; and a right rail with the
thumbnails / bookmarks / find panels plus page navigation and zoom. On Windows the window
chrome is drawn by the app (`decorations: false`); macOS keeps its traffic lights
(`titleBarStyle: Overlay`) and Linux keeps native decorations.

### Keyboard shortcuts

`Ctrl+O` open · `Ctrl+S` save · `Ctrl+Shift+S` save as · `Ctrl+P` print · `Ctrl+F` find ·
`Ctrl+W` close · `Ctrl++` / `Ctrl+-` zoom · `Ctrl+0` fit page · `Ctrl+1` actual size ·
`Ctrl+2` fit width · `Ctrl+Tab` next document · `Ctrl+Z` / `Ctrl+Y` undo / redo annotation ·
`Delete` remove selected annotation · `Esc` back to the select tool

### Known limitations

- Page-structure edits (reorder, rotate, delete, insert, page numbers, watermark, split,
  extract, combine) are refused for **encrypted** documents: pdf-lib cannot re-encrypt.
  Commenting and form filling still work on them.
- Pages combined or inserted from another document keep their content and widgets but
  lose interactive form-field definitions (a pdf-lib limitation).
- No OCR, redaction, digital certificate signing or Office conversion.

## Development

Prerequisites: Node 22+. (No Rust, no platform SDKs — Electron ships its own runtime.)

```bash
npm install
npm run dev              # Vite dev server + Electron with hot reload (add -- --devtools)
npm run dev:debug        # same, with Chromium remote debugging on port 9224
npm run typecheck        # renderer + main/preload
npm run build            # dist/ (renderer) + dist-electron/ (main, preload)
npm run dist:win         # release/Adobe PDF-<version>-win-x64.exe (NSIS)
npm run dist:mac         # release/*.dmg (universal; run on a Mac)
npm run dist:linux       # release/*.AppImage, *.deb
npm run sample           # regenerate dev/sample.pdf
```

If Electron's post-install download is blocked (npm's install-scripts policy or a flaky
network), run `npm install-scripts approve electron esbuild` and `node node_modules/electron/install.js`,
or download `electron-v<ver>-win32-x64.zip` from the Electron releases page and unzip it into
`node_modules/electron/dist` with `path.txt` containing `electron.exe`.

`npm run dev` sets `VITE_DEV_SERVER_URL`; a packaged app serves `dist/` through the
`folio://app` scheme (a real origin, so module workers and fetch work — `file://` would not).
In development the renderer also exposes `window.__folio` (`actions`, `viewers`, `store`,
`pdfops`, `files`) for scripted testing.

### Installers on GitHub Actions

[.github/workflows/build.yml](.github/workflows/build.yml) builds the Windows, macOS
(universal dmg) and Linux installers on every push to `main` (artifacts) and on `v*` tags.
The macOS app is unsigned unless you add signing secrets (see the workflow comment); first
launch needs right-click → *Open* or `xattr -cr "/Applications/Adobe PDF.app"`.

### Layout

```
electron/main.ts        main process: window, folio:// scheme, dialogs, files, single instance,
                        file associations (argv / open-file), close guard, macOS menu
electron/preload.ts     contextBridge API (`window.folio`) — the only bridge to Node
src/lib/host.ts         renderer wrapper over window.folio (dialogs, files, drag & drop, window)
src/app/actions.ts      open / save / print / export and the commit→transform→reload pipeline
src/app/viewers.ts      registry of live pdf.js viewers, zoom/navigation/editor-mode helpers
src/lib/pdfjs.ts        pdf.js bootstrap (worker, static assets, password handling)
src/lib/pdfops.ts       pdf-lib operations (reorder, rotate, merge, insert, numbers, watermark…)
src/components/         title bar (TopBar, AppMenu), CommandBar, QuickTools, RightRail, viewer, home, dialogs
src/panels/             tool panels (ToolPanel host + All tools list) and navigation panels
src/store.ts            zustand state (tabs, panels, tool, theme, recent files, modals)
```

The window is frameless on Windows/Linux (the app draws the title bar; `-webkit-app-region`
marks the draggable area) and uses `titleBarStyle: hiddenInset` on macOS so the traffic
lights stay native. The renderer runs sandboxed with context isolation; everything that
touches the file system goes through the IPC handlers in `electron/main.ts`.

### Styling note

pdf.js lays out pages, text/annotation layers and editors with the browser's default
`box-sizing: content-box` and puts a page's 9 px border *outside* the page size. The app's
`border-box` reset therefore excludes the `.pdfViewer` subtree — applying it there shrinks
every layer by 18 px and makes pointer input land beside the cursor.

### How editing works

pdf.js owns annotations and form values while a document is open. Any structural
operation first "commits" those edits (`pdf.saveDocument()`), runs a pdf-lib
transformation on the resulting bytes and reloads the viewer at the same page. Saving
does the same commit and writes the bytes to disk.
