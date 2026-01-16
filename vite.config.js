import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoName = process.env.VITE_REPO_NAME || "instagram-mvp";

export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`
});
