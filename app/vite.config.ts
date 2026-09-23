import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

const proxyTarget = process.env.VETINARI_BO_PROXY ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: { outDir: "../dist/app", emptyOutDir: true },
  server: {
    port: 5174,
    proxy: {
      "/api": proxyTarget,
    },
  },
});
