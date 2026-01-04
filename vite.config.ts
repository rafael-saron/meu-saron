import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(), // Mantém suporte ao React
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.url, "../client/src"),
      "@shared": path.resolve(import.meta.url, "../shared"),
      "@assets": path.resolve(import.meta.url, "../attached_assets"),
    },
  },
  root: path.resolve("./client"),
  build: {
    outDir: path.resolve("./dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
