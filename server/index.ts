import express, { type Request, Response, NextFunction } from "express";
import https from "https";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { getHttpsOptions } from "./https-config";
import { setupWebSocketServer } from "./websocket";

const app = express();

// CRITICAL: Intercept API/WS routes BEFORE any other middleware
// This must be the FIRST middleware registered
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
    console.log(`[EARLY INTERCEPT] API/WS route detected: ${req.method} ${req.path}`);
    // Mark this request as an API request
    (req as any).__isApiRequest = true;
  }
  next();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);

  // Try to use HTTPS if certificate is available
  let httpsServer: https.Server | null = null;
  try {
    const httpsOptions = await getHttpsOptions();
    httpsServer = https.createServer(httpsOptions, app);
    log('HTTPS certificate loaded successfully');
  } catch (error) {
    log(`HTTPS not available: ${error instanceof Error ? error.message : 'Unknown error'}`);
    log('Running in HTTP mode');
  }

  // Use HTTPS server if available, otherwise use HTTP server
  const serverToListen = httpsServer || server;

  // Setup WebSocket server for PowerShell sessions
  setupWebSocketServer(serverToListen);
  log('WebSocket server initialized for PowerShell sessions');

  serverToListen.listen(port, "0.0.0.0", () => {
    const protocol = httpsServer ? 'HTTPS' : 'HTTP';
    log(`serving on port ${port} (${protocol})`);
  });
})();
