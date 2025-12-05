import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { DatabaseStorage } from "./storage";
import { initializeCronJobs } from "./cronJobs";

const app = express();

// Trust proxy - required for secure cookies behind Replit's reverse proxy
app.set('trust proxy', 1);

// CRITICAL: Health check endpoint must be registered FIRST, before any middleware
// This ensures the endpoint responds immediately for deployment health checks
// without waiting for database connections or external services
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Also support root-level health check for some deployment systems
app.get("/_health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

const isProduction = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "saron-secret-key-change-in-production",
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: isProduction,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      sameSite: isProduction ? 'none' : 'lax',
    },
  })
);

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

async function ensureAdminUser() {
  try {
    const storage = new DatabaseStorage();
    const existingAdmin = await storage.getUserByUsername("admin");
    
    if (!existingAdmin || !existingAdmin.isActive) {
      if (existingAdmin && !existingAdmin.isActive) {
        await storage.updateUser(existingAdmin.id, { isActive: true });
        log("✅ Admin user reactivated");
      } else {
        await storage.createUser({
          username: "admin",
          email: "admin@saron.com.br",
          password: "admin123",
          fullName: "Administrador",
          role: "administrador",
          isActive: true,
        });
        log("✅ Admin user created with default credentials");
      }
    }
  } catch (error) {
    console.error("Error ensuring admin user:", error);
  }
}

(async () => {
  try {
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      throw err;
    });

    // Serve uploads directory for user avatars and other uploads
    app.use('/uploads', express.static('public/uploads'));

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
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      
      // Initialize admin user and cron jobs AFTER server is listening
      // This ensures health checks succeed before expensive operations
      setImmediate(async () => {
        try {
          await ensureAdminUser();
          log('✓ Admin user initialization complete');
        } catch (error) {
          console.error('✗ Failed to initialize admin user:', error);
          // Don't crash the server - admin can be created manually if needed
        }
        
        try {
          initializeCronJobs();
          log('✓ Cron jobs initialization complete');
        } catch (error) {
          console.error('✗ Failed to initialize cron jobs:', error);
          // Don't crash the server - cron jobs are not critical for health checks
        }
      });
    });
  } catch (error) {
    console.error('Fatal error during server initialization:', error);
    process.exit(1);
  }
})();
