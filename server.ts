import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { backendApp } from "./backend/src/app";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Redirect 127.0.0.1 → localhost in development (cookies are host-scoped)
  // This ensures session cookies work correctly when accessing via http://localhost:3000
  app.use((req, res, next) => {
    if (req.hostname === '127.0.0.1' && process.env.NODE_ENV !== 'production') {
      return res.redirect(301, `http://localhost:3000${req.originalUrl}`);
    }
    next();
  });

  // Mount backend API routes first (includes /api/*, health, uploads, conversions, media, jobs)
  app.use(backendApp);

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: path.resolve(__dirname, "vite.config.ts"),
      root: path.resolve(__dirname, "frontend"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[VELYXORA] Unified Full-Stack Platform listening on http://0.0.0.0:${PORT}`,
    );
  });
}

startServer();
