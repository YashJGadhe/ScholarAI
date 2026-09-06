/* ScholarAI frontend runner.

   In this repository the live-preview build runs from the repo root, so the
   application source lives in the root-level `src/` directory. This Vite config
   points its root at the repository root so you can run the frontend from this
   folder:

       cd frontend
       npm install
       npm run dev        → http://localhost:5173

   For a fully self-contained frontend project, copy the app source in:
       cp -r ../src ./src
   and change `root` below to `__dirname` (the default). */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  plugins: [react(), tailwindcss()],
  server: { port: 5173, open: false },
  build: { outDir: "frontend/dist", emptyOutDir: true },
});
