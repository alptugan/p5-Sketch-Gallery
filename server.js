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
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ============================================
// SECURITY & MIDDLEWARE
// ============================================

// CORS Configuration - restrict in production
const corsOptions = IS_PRODUCTION
    ? {
          origin: process.env.ALLOWED_ORIGINS?.split(",") || false,
          credentials: true,
      }
    : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" })); // Limit request body size

// Security headers
app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (IS_PRODUCTION) {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    next();
});

// Basic Auth (enabled only if both ADMIN_USER and ADMIN_PASS are set)
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASS = process.env.ADMIN_PASS || "";
const AUTH_ENABLED = ADMIN_USER.length > 0 && ADMIN_PASS.length > 0;

// Super Admin Auth (for folder management)
const SUPER_ADMIN_USER = process.env.SUPER_ADMIN_USER || "";
const SUPER_ADMIN_PASS = process.env.SUPER_ADMIN_PASS || "";
const SUPER_AUTH_ENABLED = SUPER_ADMIN_USER.length > 0 && SUPER_ADMIN_PASS.length > 0;

// Log auth config (without sensitive values in production)
if (!IS_PRODUCTION) {
    console.log("🔐 AUTH CONFIG:");
    console.log("  ADMIN_USER:", ADMIN_USER ? "✓ Set" : "✗ Not set");
    console.log("  ADMIN_PASS:", ADMIN_PASS ? "✓ Set" : "✗ Not set");
    console.log("  SUPER_ADMIN_USER:", SUPER_ADMIN_USER ? "✓ Set" : "✗ Not set");
    console.log("  SUPER_ADMIN_PASS:", SUPER_ADMIN_PASS ? "✓ Set" : "✗ Not set");
}

// Rate limit configuration
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

function shouldProtect(pathname) {
    // Public endpoints that should NOT require auth
    const publicEndpoints = [
        "/api/sketches", // GET is public for gallery viewing
        "/api/folders", // GET is public for folder list
    ];

    // Don't protect public GET endpoints
    if (publicEndpoints.includes(pathname)) {
        return false;
    }

    // Check if it's admin.html or regular admin-related files (not super-admin)
    const isRegularAdmin =
        pathname === "/admin" ||
        pathname === "/admin.html" ||
        (pathname.startsWith("/admin-dist") && !pathname.includes("super-admin"));

    return (
        isRegularAdmin || pathname.startsWith("/api/") || pathname === "/api" // just in case
    );
}

function isSuperAdminEndpoint(pathname) {
    // Paths that require super admin credentials only (or are super-admin related and should be public)
    return (
        pathname === "/super-admin" ||
        pathname === "/super-admin.html" ||
        pathname.includes("/super-admin") || // Includes all super-admin assets
        pathname.startsWith("/admin-dist/assets/") || // Allow all built assets (both admin and super-admin)
        pathname === "/api/folders" ||
        pathname.startsWith("/api/folders/")
    );
}

function authGuard(req, res, next) {
    // Skip super admin endpoints - they have their own auth
    if (isSuperAdminEndpoint(req.path)) {
        return next();
    }

    // Allow public GET requests to sketches and folders
    if ((req.path === "/api/sketches" || req.path === "/api/folders") && req.method === "GET") {
        return next();
    }

    if (!AUTH_ENABLED || !shouldProtect(req.path)) {
        return next();
    }

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

// Super Admin routes (requires super admin authentication to view)
app.get(["/super-admin", "/super-admin.html"], superAdminOnly, (req, res) => {
    if (fs.existsSync(path.join(ADMIN_DIST_DIR, "super-admin.html"))) {
        // In production, serve the built super admin page
        res.sendFile(path.join(ADMIN_DIST_DIR, "super-admin.html"));
    } else {
        // In development or if not built, serve the super-admin.html from root for Vite
        const devFile = path.join(__dirname, "super-admin.html");
        if (fs.existsSync(devFile)) {
            res.sendFile(devFile);
        } else {
            res.status(503).send(`<!doctype html>
                <html><head><meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Super Admin</title>
                <style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, sans-serif; padding:2rem; line-height:1.5}</style>
                </head><body>
                <h1>Super Admin UI</h1>
                <p>Super admin UI is not available.</p>
                <p>For development, use <code>pnpm dev</code> and access <a href="http://localhost:5173/super-admin.html">http://localhost:5173/super-admin.html</a></p>
                </body></html>`);
        }
    }
});

// Serve static files (frontend) - AFTER admin routes to avoid conflicts
app.use(
    express.static(__dirname, {
        index: "index.html",
        // Don't serve admin.html from root in production
        setHeaders: (res, filePath) => {
            if (filePath.endsWith("admin.html") && fs.existsSync(ADMIN_DIST_DIR)) {
                res.status(404);
            }
        },
    })
);

// Data file path
const DATA_DIR = path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "sketches.json");
const FOLDERS_PATH = path.join(DATA_DIR, "folders.json");
const CONFIG_PATH = path.join(__dirname, "src", "config.js");

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Middleware to check for super admin credentials
function superAdminOnly(req, res, next) {
    if (!SUPER_AUTH_ENABLED) {
        return res.status(403).json({ error: "Super admin not configured" });
    }

    const header = req.headers["authorization"] || "";
    const match = header.match(/^Basic\s+(.*)$/i);

    if (!match) {
        // Send WWW-Authenticate to trigger browser's built-in auth dialog
        res.set("WWW-Authenticate", 'Basic realm="Super Admin"');
        return res.status(401).send("Super admin authentication required");
    }

    try {
        const decoded = Buffer.from(match[1], "base64").toString("utf8");
        const [user, pass] = decoded.split(":");

        if (user === SUPER_ADMIN_USER && pass === SUPER_ADMIN_PASS) {
            return next();
        }
    } catch (err) {
        // Log error server-side only
        if (!IS_PRODUCTION) {
            console.error("❌ Error decoding credentials:", err.message);
        }
    }

    return res.status(401).send("Invalid super admin credentials");
}

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

// ============================================
// URL NORMALIZATION HELPERS (DRY)
// ============================================

// Normalize p5.js editor links to /full/ view for consistent embedding
function normalizeP5Url(rawUrl) {
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
}

// Normalize OpenProcessing links to /embed view for consistent embedding
function normalizeOpenProcessingUrl(rawUrl) {
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
}

// Combined normalization for any sketch URL
function normalizeSketchUrl(rawUrl) {
    return normalizeOpenProcessingUrl(normalizeP5Url(rawUrl));
}

// ============================================
// INPUT VALIDATION HELPERS
// ============================================

function validateFolderId(id) {
    if (!id || typeof id !== "string") return false;
    // Must be lowercase alphanumeric with hyphens only
    return /^[a-z0-9-]+$/.test(id) && id.length > 0 && id.length <= 50;
}

function validateFolderName(name) {
    if (!name || typeof name !== "string") return false;
    // Reasonable length, no control characters
    return name.trim().length > 0 && name.length <= 100 && !/[\x00-\x1F\x7F]/.test(name);
}

function validateSketchField(value, maxLength = 500) {
    if (typeof value !== "string") return false;
    const trimmed = value.trim();
    return trimmed.length > 0 && trimmed.length <= maxLength && !/[\x00-\x1F\x7F]/.test(value);
}

function validateUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
        const u = new URL(url);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function validateDimension(value) {
    const num = Number(value);
    return !isNaN(num) && num > 0 && num <= 10000 && Number.isInteger(num);
}

function sanitizeString(str) {
    if (typeof str !== "string") return "";
    // Remove any potential script tags and null bytes
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/\0/g, "");
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
    // Read folders
    let folders = [];
    if (fs.existsSync(FOLDERS_PATH)) {
        folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
    }

    const banner = `// Helper function to generate URL-friendly slugs from titles and author\nfunction normalizeAscii(str) {\n    return str\n        .normalize(\"NFD\")\n        .replace(/[\\u0300-\\u036f]/g, \"\")\n        .replace(/[İ]/g, \"I\")\n        .replace(/[ı]/g, \"i\");\n}\n\nfunction generateSlug(title, author) {\n    const lastName = normalizeAscii(author).trim().split(\" \").pop().toLowerCase();\n    const titleSlug = normalizeAscii(title)\n        .toLowerCase()\n        .trim()\n        .replace(/[^a-z0-9\\s-]/g, \"\")\n        .replace(/\\s+/g, \"-\")\n        .replace(/-+/g, \"-\")\n        .replace(/^-+|-+$/g, \"\");\n    return \`${"${titleSlug}-${lastName}"}\`;\n}\n\n`;

    const normalized = sketches.map((s) => ({
        ...s,
        url: normalizeSketchUrl(s.url),
    }));

    const sketchesLiteral = JSON.stringify(normalized, null, 4)
        .replace(/"(\w+)":/g, "$1:") // remove quotes from keys for nicer look
        .replace(/\\n/g, "\\n");

    const foldersLiteral = JSON.stringify(folders, null, 4).replace(/"(\w+)":/g, "$1:"); // remove quotes from keys

    const config = `${banner}const sketchesData = ${sketchesLiteral};\n\nconst foldersData = ${foldersLiteral};\n\nconst Config = {\n    sketches: sketchesData.map((sketch) => ({\n        ...sketch,\n        slug: generateSlug(sketch.title, sketch.author),\n    })),\n    folders: foldersData,\n};\n\nexport default Config;\n`;

    fs.writeFileSync(CONFIG_PATH, config);
}

// ensureAdminAssets removed: use `pnpm build:admin` to produce admin-dist before start

// ============================================
// FOLDERS API (Super Admin Only)
// ============================================

// Get all folders
app.get("/api/folders", (req, res) => {
    try {
        if (!fs.existsSync(FOLDERS_PATH)) {
            return res.json([]);
        }
        const folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
        res.json(folders);
    } catch (e) {
        res.status(500).json({ error: "Failed to read folders" });
    }
});

// Create new folder (super admin only)
app.post("/api/folders", superAdminOnly, SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    try {
        const { id, name, isDefault } = req.body || {};

        // Validate inputs
        if (!validateFolderId(id)) {
            return res
                .status(400)
                .json({ error: "Invalid folder id: must be lowercase alphanumeric with hyphens (1-50 chars)" });
        }
        if (!validateFolderName(name)) {
            return res.status(400).json({ error: "Invalid folder name: must be 1-100 characters" });
        }

        let folders = [];
        if (fs.existsSync(FOLDERS_PATH)) {
            folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
        }

        if (folders.some((f) => f.id === id)) {
            return res.status(409).json({ error: "Folder with this id already exists" });
        }

        // If this is set as default, remove default from others
        if (isDefault) {
            folders = folders.map((f) => ({ ...f, isDefault: false }));
        }

        const newFolder = {
            id: sanitizeString(id),
            name: sanitizeString(name),
            isDefault: Boolean(isDefault),
        };

        folders.push(newFolder);
        fs.writeFileSync(FOLDERS_PATH, JSON.stringify(folders, null, 2));
        regenerateConfig(readSketches());

        res.json({ success: true, folder: newFolder });
    } catch (e) {
        console.error("Error creating folder:", e);
        res.status(500).json({ error: "Failed to create folder" });
    }
});

// Update folder (super admin only)
app.put("/api/folders/:id", superAdminOnly, SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    const { id } = req.params;
    const { name, isDefault } = req.body || {};
    if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
    }
    try {
        if (!fs.existsSync(FOLDERS_PATH)) {
            return res.status(404).json({ error: "Folders file not found" });
        }
        let folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
        const index = folders.findIndex((f) => f.id === id);
        if (index === -1) {
            return res.status(404).json({ error: "Folder not found" });
        }
        // If this is set as default, remove default from others
        if (isDefault) {
            folders = folders.map((f) => ({ ...f, isDefault: false }));
        }
        folders[index] = { ...folders[index], name, isDefault: isDefault || false };
        fs.writeFileSync(FOLDERS_PATH, JSON.stringify(folders, null, 2));
        regenerateConfig(readSketches()); // Pass current sketches
        res.json({ success: true, folder: folders[index] });
    } catch (e) {
        res.status(500).json({ error: "Failed to update folder" });
    }
});

// Delete folder (super admin only)
app.delete("/api/folders/:id", superAdminOnly, SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    const { id } = req.params;
    try {
        if (!fs.existsSync(FOLDERS_PATH)) {
            return res.status(404).json({ error: "Folders file not found" });
        }
        let folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
        const index = folders.findIndex((f) => f.id === id);
        if (index === -1) {
            return res.status(404).json({ error: "Folder not found" });
        }
        // Check if any sketches use this folder
        const sketches = readSketches();
        const sketchCount = sketches.filter((s) => s.week === id).length;
        if (sketchCount > 0) {
            return res.status(400).json({
                error: `Cannot delete folder: ${sketchCount} sketch(es) are using it`,
                sketchCount,
            });
        }
        folders.splice(index, 1);
        // If we deleted the default folder and there are other folders, make the first one default
        if (!folders.some((f) => f.isDefault) && folders.length > 0) {
            folders[0].isDefault = true;
        }
        fs.writeFileSync(FOLDERS_PATH, JSON.stringify(folders, null, 2));
        regenerateConfig(readSketches()); // Pass current sketches
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete folder" });
    }
});

// ============================================
// SKETCHES API
// ============================================

app.get("/api/sketches", (req, res) => {
    const sketches = readSketches();
    res.json(sketches.map((s) => ({ ...s, slug: generateSlug(s.title, s.author) })));
});

app.post("/api/sketches", SHOULD_RATE_LIMIT ? protectedLimiter : noLimit, (req, res) => {
    try {
        const { author, title, description, url, width, height, week } = req.body || {};

        // Validate required fields
        if (!validateSketchField(author, 100)) {
            return res.status(400).json({ error: "Invalid author: must be 1-100 characters" });
        }
        if (!validateSketchField(title, 200)) {
            return res.status(400).json({ error: "Invalid title: must be 1-200 characters" });
        }
        if (!validateUrl(url)) {
            return res.status(400).json({ error: "Invalid URL format" });
        }
        if (!validateDimension(width) || !validateDimension(height)) {
            return res.status(400).json({ error: "Invalid dimensions: must be positive integers (1-10000)" });
        }
        if (!validateFolderId(week)) {
            return res.status(400).json({ error: "Invalid week/folder id" });
        }

        // Validate week exists in folders
        if (fs.existsSync(FOLDERS_PATH)) {
            const folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
            if (!folders.some((f) => f.id === week)) {
                return res.status(400).json({ error: "Week/folder does not exist" });
            }
        }

        const sketches = readSketches();
        const slug = generateSlug(title, author);

        if (sketches.some((s) => generateSlug(s.title, s.author) === slug)) {
            return res.status(409).json({ error: "A sketch with same title/author already exists" });
        }

        const item = {
            author: sanitizeString(author),
            title: sanitizeString(title),
            description: sanitizeString(description || ""),
            url: normalizeSketchUrl(url),
            width: Number(width),
            height: Number(height),
            week: sanitizeString(week),
        };

        sketches.push(item);
        writeSketches(sketches);
        res.status(201).json({ ...item, slug });
    } catch (e) {
        console.error("Error creating sketch:", e);
        res.status(500).json({ error: "Failed to create sketch" });
    }
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
    try {
        const originalSlug = req.params.slug;
        let sketches = readSketches();
        const idx = sketches.findIndex((s) => generateSlug(s.title, s.author) === originalSlug);

        if (idx === -1) {
            return res.status(404).json({ error: "Sketch not found" });
        }

        const current = sketches[idx];
        const { author, title, description, url, width, height, week } = req.body || {};

        // Validate inputs if provided
        if (author !== undefined && !validateSketchField(author, 100)) {
            return res.status(400).json({ error: "Invalid author: must be 1-100 characters" });
        }
        if (title !== undefined && !validateSketchField(title, 200)) {
            return res.status(400).json({ error: "Invalid title: must be 1-200 characters" });
        }
        if (url !== undefined && !validateUrl(url)) {
            return res.status(400).json({ error: "Invalid URL format" });
        }
        if (width !== undefined && !validateDimension(width)) {
            return res.status(400).json({ error: "Invalid width: must be positive integer (1-10000)" });
        }
        if (height !== undefined && !validateDimension(height)) {
            return res.status(400).json({ error: "Invalid height: must be positive integer (1-10000)" });
        }
        if (week !== undefined && !validateFolderId(week)) {
            return res.status(400).json({ error: "Invalid week/folder id" });
        }

        // Validate week exists if provided
        if (week && fs.existsSync(FOLDERS_PATH)) {
            const folders = JSON.parse(fs.readFileSync(FOLDERS_PATH, "utf-8"));
            if (!folders.some((f) => f.id === week)) {
                return res.status(400).json({ error: "Week/folder does not exist" });
            }
        }

        const updated = {
            author: author !== undefined ? sanitizeString(author) : current.author,
            title: title !== undefined ? sanitizeString(title) : current.title,
            description: description !== undefined ? sanitizeString(description) : current.description,
            url: url !== undefined ? normalizeSketchUrl(url) : current.url,
            width: width !== undefined ? Number(width) : current.width,
            height: height !== undefined ? Number(height) : current.height,
            week: week !== undefined ? sanitizeString(week) : current.week,
        };

        const newSlug = generateSlug(updated.title, updated.author);

        // If slug changes, ensure no conflict with another entry
        if (
            newSlug !== originalSlug &&
            sketches.some((s, i) => i !== idx && generateSlug(s.title, s.author) === newSlug)
        ) {
            return res.status(409).json({ error: "A sketch with same title/author already exists" });
        }

        sketches[idx] = updated;
        writeSketches(sketches);
        res.json({ ...updated, slug: newSlug });
    } catch (e) {
        console.error("Error updating sketch:", e);
        res.status(500).json({ error: "Failed to update sketch" });
    }
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
