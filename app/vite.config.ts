import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  // Read the repository `.env` the server uses, so a changed backoffice port
  // moves the proxy with it. Only config sees these; none reach the bundle.
  const env = loadEnv(mode, fileURLToPath(new URL("..", import.meta.url)), "VETINARI_BO_");
  const proxyTarget = env.VETINARI_BO_PROXY ?? `http://localhost:${env.VETINARI_BO_PORT ?? "3100"}`;

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    build: { outDir: "../dist/app", emptyOutDir: true },
    server: {
      // 5174 belongs to Vetinari's Agent Console, which runs alongside.
      port: 5175,
      strictPort: true,
      proxy: {
        "/api": proxyTarget,
      },
    },
  };
});
