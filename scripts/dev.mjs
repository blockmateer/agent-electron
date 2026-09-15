// Development: start the Vite dev server, build main/preload, launch Electron
// against the dev server (hot reload for the renderer). Extra CLI arguments
// are passed to Electron, e.g. `npm run dev -- --devtools`.
import { spawn } from "node:child_process";
import { createServer } from "vite";
import electronPath from "electron";
import { build } from "esbuild";

const server = await createServer({ configFile: "vite.config.ts", server: { host: "127.0.0.1", port: 1421, strictPort: true } });
await server.listen();
const url = `http://127.0.0.1:1421/`;
server.printUrls();

const common = { bundle: true, platform: "node", target: "node22", format: "cjs", external: ["electron"], logLevel: "warning" };
await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.cjs" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.cjs" });

// ELECTRON_RUN_AS_NODE (set by editors such as VS Code) would turn Electron
// into a plain Node process; make sure it never leaks into the app.
const env = { ...process.env, VITE_DEV_SERVER_URL: url };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electronPath, [".", ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
