import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { DatabaseStorage } from "./storage";
import { initializeCronJobs } from "./cronJobs";
import { pgPool, ensureAdminUser } from "./db";

const app = express();

/**
 * Express + PostgreSQL session store
 */
const PgSession = connectPgSimple(session);

/**
 * Railway / Reverse proxy
 */
app.set("trust proxy", 1);

/**
 * Health checks (Railway)
 */
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/_health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * Tipagens auxiliares
 */
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

/**
 * Body parsers
 */
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

/**
 * Sessão persistente no PostgreSQL
 */
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "CHANGE_ME",
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: {
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  })
);

/**
 * Logger de API
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    res.locals.body = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (res.locals.body) {
        const bodyStr = JSON.stringify(res.locals.body);
        logLine += ` :: ${
          bodyStr.length > 80 ? bodyStr.slice(0, 79) + "…" : bodyStr
        }`;
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Bootstrap do servidor
 */
(async () => {
  try {
    const server = await registerRoutes(app);

    app.use(
      (err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        res.status(status).json({
          message: err.message || "Internal Server Error",
        });
      }
    );

    app.use("/uploads", express.static("public/uploads"));

    /**
     * ⚠️ IMPORTANTE:
     * Railway = produção SEMPRE
     */
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const port = Number(process.env.PORT || 3000);

    server.listen(port, "0.0.0.0", async () => {
      log(`🚀 Server running on port ${port}`);

      // ✅ Garante admin e inicializa cron jobs
      await ensureAdminUser();
      log("✓ Admin initialization complete");

      initializeCronJobs();
      log("✓ Cron jobs initialized");
    });
  } catch (error) {
    console.error("🔥 Fatal server error:", error);
    process.exit(1);
  }
})();
