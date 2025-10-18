import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
// Removed legacy auto-build hooks (esbuild/tailwind) in favor of Vite build
import rateLimit from "express-rate-limit";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Basic Auth (enabled only if both ADMIN_USER and ADMIN_PASS are set)
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const AUTH_ENABLED = ADMIN_USER.length > 0 && ADMIN_PASS.length > 0;

function shouldProtect(pathname) {
    return (
        pathname === "/admin" ||
        pathname === "/admin.html" ||
        pathname.startsWith("/admin-dist") ||
        pathname.startsWith("/api/") ||
        pathname === "/api" // just in case
    );
}

function basicAuthMiddleware(req, res, next) {
    if (!AUTH_ENABLED) return next();
    if (!shouldProtect(req.path)) return next();

    const header = req.headers["authorization"] || "";
    const match = header.match(/^Basic\s+(.*)$/i);
    if (!match) {
        res.set("WWW-Authenticate", 'Basic realm="Admin"');
        return res.status(401).send("Authentication required");
    }
    try {
        const decoded = Buffer.from(match[1], "base64").toString("utf8");
        const [user, pass] = decoded.split(":");
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            return next();
        }
    } catch (_) {}
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Invalid credentials");
}

// Apply auth check before static and routes
// Rate limit only protected endpoints when auth is enabled and only for mutating methods
const protectedLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    limit: 200, // generous overall limit for authenticated ops
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip if auth is disabled
        if (!AUTH_ENABLED) return true;
        // Skip non-protected paths (public site, assets, etc.)
        if (!shouldProtect(req.path)) return true;
        // Allow safe/idempotent requests without rate limiting
        const method = (req.method || "GET").toUpperCase();
        if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;
        return false;
    },
});

// Simple lockout after repeated bad credentials per IP
const failedMap = new Map(); // ip -> { count, until }
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

function authGuard(req, res, next) {
    if (!AUTH_ENABLED || !shouldProtect(req.path)) return next();

    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const rec = failedMap.get(ip);
    const now = Date.now();

    // Check provided credentials first; allow valid creds even if previously locked
    const header = req.headers["authorization"] || "";
    const match = header.match(/^Basic\s+(.*)$/i);
    if (match) {
        try {
            const decoded = Buffer.from(match[1], "base64").toString("utf8");
            const [user, pass] = decoded.split(":");
            if (user === ADMIN_USER && pass === ADMIN_PASS) {
                if (rec) failedMap.delete(ip); // clear any lockout
                return next();
            }
        } catch (_) {
            // fall through to failure handling
        }
    }

    // If currently locked and no valid creds supplied, block
    if (rec && rec.until && rec.until > now) {
        res.set("WWW-Authenticate", 'Basic realm="Admin"');
        return res.status(429).send("Too many failed attempts. Try again later.");
    }

    // No credentials -> ask for auth without incrementing failure counter
    if (!match) {
        res.set("WWW-Authenticate", 'Basic realm="Admin"');
        return res.status(401).send("Authentication required");
    }

    // Bad credentials: increment and possibly lock
    const nextRec = rec && rec.until > now ? rec : { count: 0, until: 0 };
    nextRec.count += 1;
    if (nextRec.count >= MAX_FAILS) {
        nextRec.until = now + LOCK_MS;
    }
    failedMap.set(ip, nextRec);
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    // If just locked, surface 429; otherwise 401
    if (nextRec.until && nextRec.until > now) {
        return res.status(429).send("Too many failed attempts. Try again later.");
    }
    return res.status(401).send("Invalid credentials");
}

// Apply auth guard before any static/route
app.use(authGuard);

// Helper to enable/disable rate limiting on mutating routes
const SHOULD_RATE_LIMIT = AUTH_ENABLED && process.env.NODE_ENV === "production";
const noLimit = (req, res, next) => next();

// Serve static files (frontend)
app.use(express.static(__dirname));
// Serve Vite build output for admin in production at /admin-dist
const ADMIN_DIST_DIR = path.join(__dirname, "admin-dist");
if (fs.existsSync(ADMIN_DIST_DIR)) {
    app.use("/admin-dist", express.static(ADMIN_DIST_DIR));
    // Serve the built admin HTML at /admin.html (still passes through basicAuthMiddleware)
    app.get(["/admin", "/admin.html"], (req, res) => {
        res.sendFile(path.join(ADMIN_DIST_DIR, "admin.html"));
    });
} else {
    console.warn("[WARN] admin-dist/ not found. Run `pnpm build:admin` to build the admin UI.");
    // Provide a friendly message at /admin.html when not built
    app.get(["/admin", "/admin.html"], (req, res) => {
        res.status(503).send(`<!doctype html>
            <html><head><meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Admin not built</title>
            <style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif; padding:2rem; line-height:1.5}</style>
            </head><body>
            <h1>Admin UI is not built</h1>
            <p>Please run <code>pnpm build:admin</code> and restart the server.</p>
            <p>For development with hot reloading, use <code>pnpm dev</code> and open <a href="http://localhost:5173/admin-dist/">Vite admin</a>.</p>
            </body></html>`);
    });
}

// Data file path
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "sketches.json");
const CONFIG_PATH = path.join(__dirname, "src", "config.js");

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Serve config.js explicitly with a JS MIME type
app.get("/src/config.js", (req, res) => {
    try {
        const js = fs.readFileSync(CONFIG_PATH, "utf-8");
        res.type("application/javascript").send(js);
    } catch (e) {
        res.status(404).type("text/plain").send("config.js not found");
    }
});

// Helper: slug generator same as in config.js
function normalizeAscii(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[İ]/g, "I")
        .replace(/[ı]/g, "i");
}

function generateSlug(title, author) {
    const lastName = normalizeAscii(author).trim().split(" ").pop().toLowerCase();
    const titleSlug = normalizeAscii(title)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    return `${titleSlug}-${lastName}`;
}

// Global helper: if link includes both "editor" and "openprocessing" and doesn't end with "/embed",
// append "/embed"; otherwise, leave unchanged.
function normalizeOpenProcessing(rawUrl) {
    try {
        const urlStr = String(rawUrl);
        const lower = urlStr.toLowerCase();
        if (!lower.includes("openprocessing") || !lower.includes("editor")) return rawUrl;
        const u = new URL(urlStr);
        if (!u.pathname.endsWith("/embed")) {
            u.pathname = u.pathname.replace(/\/$/, "") + "/embed";
        }
        return u.toString();
    } catch {
        return rawUrl;
    }
}

// Load sketches from JSON (or initial from config.js if missing)
function readSketches() {
    if (fs.existsSync(DATA_PATH)) {
        try {
            const raw = fs.readFileSync(DATA_PATH, "utf-8");
            return JSON.parse(raw);
        } catch (e) {
            console.error("Failed to read sketches.json", e);
        }
    }
    // Fallback: parse current src/config.js to bootstrap
    try {
        const configSource = fs.readFileSync(CONFIG_PATH, "utf-8");
        // Naive parse: eval limited to extract sketches array literal
        const match = configSource.match(/const sketchesData = (\[([\s\S]*?)\]);/);
        if (match) {
            const arrLiteral = match[1];
            // Use Function to safely evaluate array literal into JS object (no variables referenced inside)
            // eslint-disable-next-line no-new-func
            const parsed = Function(`return (${arrLiteral});`)();
            return parsed;
        }
    } catch (e) {
        console.error("Failed to bootstrap from config.js", e);
    }
    return [];
}

function writeSketches(sketches) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(sketches, null, 2));
    regenerateConfig(sketches);
}

// Rebuild src/config.js from data to keep frontend working w/o API changes
function regenerateConfig(sketches) {
    // Normalize p5 editor links to full view so frontend embeds are consistent
    const normalizeP5 = (rawUrl) => {
        try {
            const urlStr = String(rawUrl);
            const lower = urlStr.toLowerCase();
            if (!lower.includes("p5js") || !lower.includes("editor")) return rawUrl;
            const u = new URL(urlStr);
            if (!u.hostname.toLowerCase().startsWith("editor.") || !u.hostname.toLowerCase().includes("p5js.org"))
                return rawUrl;
            u.pathname = u.pathname.replace(/\/(sketches|edit)\//, "/full/");
            return u.toString();
        } catch {
            return rawUrl;
        }
    };
    const normalizeOpenProcessing = (rawUrl) => {
        try {
            const urlStr = String(rawUrl);
            const lower = urlStr.toLowerCase();
            if (!lower.includes("openprocessing")) return rawUrl;
            const u = new URL(urlStr);
            // Only force embed for sketch pages
            if (/\/sketch\//.test(u.pathname) && !u.pathname.endsWith("/embed")) {
                u.pathname = u.pathname.replace(/\/$/, "") + "/embed";
            }
            return u.toString();
        } catch {
            return rawUrl;
        }
    };
    const banner = `// Helper function to generate URL-friendly slugs from titles and author\nfunction normalizeAscii(str) {\n    return str\n        .normalize(\"NFD\")\n        .replace(/[\\u0300-\\u036f]/g, \"\")\n        .replace(/[İ]/g, \"I\")\n        .replace(/[ı]/g, \"i\");\n}\n\nfunction generateSlug(title, author) {\n    const lastName = normalizeAscii(author).trim().split(\" \").pop().toLowerCase();\n    const titleSlug = normalizeAscii(title)\n        .toLowerCase()\n        .trim()\n        .replace(/[^a-z0-9\\s-]/g, \"\")\n        .replace(/\\s+/g, \"-\")\n        .replace(/-+/g, \"-\")\n        .replace(/^-+|-+$/g, \"\");\n    return \`${"${titleSlug}-${lastName}"}\`;\n}\n\n`;

    const normalized = sketches.map((s) => ({
        ...s,
        url: normalizeOpenProcessing(normalizeP5(s.url)),
    }));

    const sketchesLiteral = JSON.stringify(normalized, null, 4)
        .replace(/"(\w+)":/g, "$1:") // remove quotes from keys for nicer look
        .replace(/\\n/g, "\\n");

    const config = `${banner}const sketchesData = ${sketchesLiteral};\n\nconst Config = {\n    sketches: sketchesData.map((sketch) => ({\n        ...sketch,\n        slug: generateSlug(sketch.title, sketch.author),\n    })),\n};\n\nexport default Config;\n`;

    fs.writeFileSync(CONFIG_PATH, config);
}

// ensureAdminAssets removed: use `pnpm build:admin` to produce admin-dist before start

// API
app.get("/api/sketches", (req, res) => {
    const sketches = readSketches();
    res.json(sketches.map((s) => ({ ...s, slug: generateSlug(s.title, s.author) })));
});

app.post("/api/sketches", SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    const { author, title, description, url, width, height } = req.body || {};
    if (!author || !title || !url || !width || !height) {
        return res.status(400).json({ error: "Missing required fields: author, title, url, width, height" });
    }
    const sketches = readSketches();
    const slug = generateSlug(title, author);
    if (sketches.some((s) => generateSlug(s.title, s.author) === slug)) {
        return res.status(409).json({ error: "A sketch with same title/author already exists" });
    }
    const normalizeP5 = (rawUrl) => {
        try {
            const urlStr = String(rawUrl);
            const lower = urlStr.toLowerCase();
            if (!lower.includes("p5js") || !lower.includes("editor")) return rawUrl;
            const u = new URL(urlStr);
            if (!u.hostname.toLowerCase().startsWith("editor.") || !u.hostname.toLowerCase().includes("p5js.org"))
                return rawUrl;
            u.pathname = u.pathname.replace(/\/(sketches|edit)\//, "/full/");
            return u.toString();
        } catch {
            return rawUrl;
        }
    };
    const item = {
        author,
        title,
        description: description || "",
        url: normalizeOpenProcessing(normalizeP5(url)),
        width: Number(width),
        height: Number(height),
    };
    sketches.push(item);
    writeSketches(sketches);
    res.status(201).json({ ...item, slug });
});

app.delete("/api/sketches/:slug", SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    const slug = req.params.slug;
    let sketches = readSketches();
    const before = sketches.length;
    sketches = sketches.filter((s) => generateSlug(s.title, s.author) !== slug);
    if (sketches.length === before) {
        return res.status(404).json({ error: "Not found" });
    }
    writeSketches(sketches);
    res.json({ ok: true });
});

// Update a sketch by slug
app.patch("/api/sketches/:slug", SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    const originalSlug = req.params.slug;
    let sketches = readSketches();
    const idx = sketches.findIndex((s) => generateSlug(s.title, s.author) === originalSlug);
    if (idx === -1) return res.status(404).json({ error: "Not found" });

    const current = sketches[idx];
    const { author, title, description, url, width, height } = req.body || {};

    const normalizeP5 = (rawUrl) => {
        try {
            const urlStr = String(rawUrl);
            const lower = urlStr.toLowerCase();
            if (!lower.includes("p5js") || !lower.includes("editor")) return rawUrl;
            const u = new URL(urlStr);
            if (!u.hostname.toLowerCase().startsWith("editor.") || !u.hostname.toLowerCase().includes("p5js.org"))
                return rawUrl;
            u.pathname = u.pathname.replace(/\/(sketches|edit)\//, "/full/");
            return u.toString();
        } catch {
            return rawUrl;
        }
    };
    const normalizeOpenProcessing = (rawUrl) => {
        try {
            const urlStr = String(rawUrl);
            const lower = urlStr.toLowerCase();
            if (!lower.includes("openprocessing") || !lower.includes("editor")) return rawUrl;
            const u = new URL(urlStr);
            if (!u.pathname.endsWith("/embed")) {
                u.pathname = u.pathname.replace(/\/$/, "") + "/embed";
            }
            return u.toString();
        } catch {
            return rawUrl;
        }
    };

    const updated = {
        author: author !== undefined ? author : current.author,
        title: title !== undefined ? title : current.title,
        description: description !== undefined ? description : current.description,
        url: url !== undefined ? normalizeOpenProcessing(normalizeP5(url)) : current.url,
        width: width !== undefined ? Number(width) : current.width,
        height: height !== undefined ? Number(height) : current.height,
    };

    const newSlug = generateSlug(updated.title, updated.author);
    // If slug changes, ensure no conflict with another entry
    if (newSlug !== originalSlug && sketches.some((s, i) => i !== idx && generateSlug(s.title, s.author) === newSlug)) {
        return res.status(409).json({ error: "A sketch with same title/author already exists" });
    }

    sketches[idx] = updated;
    writeSketches(sketches);
    return res.json({ ...updated, slug: newSlug });
});

// Start server
app.listen(PORT, () => {
    // On boot, ensure config.js reflects current data store
    try {
        const sketches = readSketches();
        regenerateConfig(sketches);
    } catch (e) {
        console.error("Failed to regenerate config on boot", e);
    }
    console.log(`Server running at http://localhost:${PORT}`);
});
