import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config for building admin and super-admin UIs
export default defineConfig(({ mode }) => ({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy API calls to the Express backend during dev
            "/api": "http://localhost:3300",
        },
    },
    build: {
        outDir: "admin-dist",
        emptyOutDir: true,
        rollupOptions: {
            // Build from admin.html and super-admin.html as HTML entries
            input: {
                admin: "admin.html",
                "super-admin": "super-admin.html",
            },
        },
    },
    // Ensure built asset URLs are served from /admin-dist in production only
    base: mode === "production" ? "/admin-dist/" : "/",
}));
