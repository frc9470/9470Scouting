import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const tbaAuthKey = env.TBA_AUTH_KEY || env.TBA_API_KEY;

  return {
    base: "./",
    plugins: [react()],
    server: {
      proxy: {
        "/api/tba": {
          target: "https://www.thebluealliance.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/tba/, "/api/v3"),
          headers: tbaAuthKey ? { "X-TBA-Auth-Key": tbaAuthKey } : undefined,
        },
      },
    },
  };
});
