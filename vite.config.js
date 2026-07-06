import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set base to the repo/subpath name when deploying to GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
});
