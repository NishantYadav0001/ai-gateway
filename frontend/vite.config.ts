import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  base: './', // <-- THIS IS THE CRITICAL FIX FOR HUGGING FACE ASSET ROUTING
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: { // <-- THIS TELLS VITE WHERE TO PUT THE COMPILED FILES FOR SPRING BOOT
    outDir: '../src/main/resources/static',
    emptyOutDir: true,
  }
});