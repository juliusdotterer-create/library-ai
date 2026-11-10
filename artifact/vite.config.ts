/**
 * Build der App als einzelne, eigenständige HTML-Seite (z. B. als Claude-Artifact).
 *   npx vite build --config artifact/vite.config.ts && node artifact/inline.mjs
 * Ergebnis: artifact/dist/library.html
 */
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const src = fileURLToPath(new URL("../src", import.meta.url));
const artifactRoot = fileURLToPath(new URL("./root.tsx", import.meta.url));

/** Worker-Dateien als Blob-URL einbetten, weil die Seite keine Nebendateien lädt. */
function inlineWorkers(): Plugin {
  const PDF_URL = "pdfjs-dist/build/pdf.worker.min.mjs?url";
  return {
    name: "artifact-inline-workers",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id === PDF_URL) return "\0pdf-worker-url";
      if (id.endsWith("pdf-compat.worker?worker")) {
        const r = await this.resolve(id.replace("?worker", ""), importer, { skipSelf: true });
        return r ? r.id + "?worker&inline" : null;
      }
      if (/[\\/]routes[\\/]__root(\.tsx)?$/.test(id) || id === "./routes/__root") return artifactRoot;
      return null;
    },
    load(id) {
      if (id === "\0pdf-worker-url") {
        return `import code from "pdfjs-dist/build/pdf.worker.min.mjs?raw";
export default URL.createObjectURL(new Blob([code], { type: "text/javascript" }));`;
      }
      return null;
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [inlineWorkers(), react(), tailwindcss()],
  resolve: { alias: { "@": src } },
  worker: { format: "es" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { inlineDynamicImports: true } },
  },
});
