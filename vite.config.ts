import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const apiPort = process.env.WORKBENCH_UI_API_PORT ?? "4310";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (request) =>
            request.setHeader("origin", `http://127.0.0.1:${apiPort}`),
          );
        },
      },
    },
  },
});
