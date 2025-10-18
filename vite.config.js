import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config focused on building the admin UI from admin.html
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            // Proxy API calls to the Express backend during dev
            "/api": "http://localhost:3000",
        },
    },
    build: {
        outDir: "admin-dist",
        emptyOutDir: true,
        rollupOptions: {
            // Build from admin.html as the HTML entry
            input: {
                admin: "admin.html",
            },
        },
    },
    // Ensure built asset URLs are served from /admin-dist in production
    base: "/admin-dist/",
});
