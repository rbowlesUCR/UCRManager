import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Dynamically import vite config to avoid bundling issues
  const viteConfigModule = await import("../vite.config");
  const viteConfig = viteConfigModule.default;

  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        process.cwd(),
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // Support both bundled (dist/index.js) and unbundled (server/vite.ts) paths
  const distPath = fs.existsSync(path.resolve(process.cwd(), "dist", "public"))
    ? path.resolve(process.cwd(), "dist", "public")
    : path.resolve(process.cwd(), "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Create static file handler
  const staticHandler = express.static(distPath);

  // Serve static files, but NEVER for API/WS routes marked by early interceptor
  app.use((req, res, next) => {
    const isApiRequest = (req as any).__isApiRequest;

    if (isApiRequest) {
      console.log(`[STATIC] Skipping static handler for marked API request: ${req.path}`);
      return next();
    }

    staticHandler(req, res, next);
  });

  // Fall through to index.html, but NEVER for API/WS routes
  app.use((req, res, next) => {
    const isApiRequest = (req as any).__isApiRequest;

    if (isApiRequest) {
      console.log(`[STATIC] Skipping index.html for marked API request: ${req.path}`);
      return next();
    }

    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
