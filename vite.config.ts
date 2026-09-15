import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [
    react(),
    // pdf.js loads these lazily at runtime (fonts, CMaps, image decoders,
    // annotation icons), so they must be served as plain static files.
    viteStaticCopy({
      targets: [
        { src: "node_modules/pdfjs-dist/cmaps/**", dest: "pdfjs", rename: { stripBase: 2 } },
        { src: "node_modules/pdfjs-dist/standard_fonts/**", dest: "pdfjs", rename: { stripBase: 2 } },
        { src: "node_modules/pdfjs-dist/wasm/**", dest: "pdfjs", rename: { stripBase: 2 } },
        { src: "node_modules/pdfjs-dist/iccs/**", dest: "pdfjs", rename: { stripBase: 2 } },
        { src: "node_modules/pdfjs-dist/web/images/**", dest: "pdfjs", rename: { stripBase: 3 } },
      ],
    }),
  ],
  build: {
    chunkSizeWarningLimit: 4000,
  },
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    host: "127.0.0.1",
  },
}));
