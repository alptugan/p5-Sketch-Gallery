// import css during dev for vite reloading
// import "./reset.css";
// import "./styles.css";

import config from "./config.js";
const sketches = Array.isArray(config?.sketches) ? config.sketches : [];

function getSlugFromHash() {
    return decodeURIComponent(location.hash.replace(/^#/, "") || "");
}

function setHashIfValid(slug) {
    if (slug) history.replaceState(null, "", `#${encodeURIComponent(slug)}`);
}

function getDefaultSlug() {
    return sketches[0]?.slug || null;
}

class AppRoot extends HTMLElement {
    connectedCallback() {
        let slug = getSlugFromHash();

        // If missing or not found, use default without writing "#undefined"
        if (!slug || !sketches.some((s) => s.slug === slug)) {
            slug = getDefaultSlug();
            setHashIfValid(slug);
        }

        this.render(slug);
        window.addEventListener("hashchange", () => {
            const next = getSlugFromHash();
            if (next && sketches.some((s) => s.slug === next)) {
                this.render(next);
            } else {
                const fallback = getDefaultSlug();
                setHashIfValid(fallback);
                this.render(fallback);
            }
        });
    }

    css() {
        return /*css*/ `
      custom-app {
        position: absolute;
        display: block;
        width: 100%;
        height: 100%;
      }
    `;
    }

    render(slug) {
        // If still no data, show empty state instead of crashing
        if (!sketches.length) {
            this.innerHTML = `<p>No sketches available.</p>`;
            return;
        }

        // find the sketch by slug and render it
        const sketch = sketches.find((s) => s.slug === slug) ?? sketches[0];

        // handle hash "routes"
        const rawHash = window.location.hash.substring(1);
        let sketchId = rawHash ? decodeURIComponent(rawHash) : "";
        if (sketchId === "") {
            let randomIndex = Math.floor(Math.random() * Config.sketches.length);
            window.location.hash = encodeURIComponent(Config.sketches[randomIndex].slug); // default
        }
        const sketchInfo = Config.sketches.find((s) => s.slug === sketchId);

        // Fallback if slug not found (e.g., encoded unicode differences)
        if (!sketchInfo) {
            const fallback = Config.sketches[0];
            window.location.hash = encodeURIComponent(fallback.slug);
            return;
        }

        // Ensure p5.js links use the "full" view instead of the editor
        function normalizeP5Url(rawUrl) {
            try {
                const urlStr = String(rawUrl);
                const includesP5 = urlStr.toLowerCase().includes("p5js");
                const includesEditor = urlStr.toLowerCase().includes("editor");
                if (!includesP5 || !includesEditor) return rawUrl;

                const u = new URL(urlStr);
                const host = u.hostname.toLowerCase();
                // Only handle p5 editor host
                if (!host.includes("p5js.org") || !host.startsWith("editor.")) return rawUrl;

                // Convert common editor paths to full view
                // e.g., /username/sketches/ABC123 -> /username/full/ABC123
                //       /username/edit/ABC123 -> /username/full/ABC123
                u.pathname = u.pathname.replace(/\/(sketches|edit)\//, "/full/");
                return u.toString();
            } catch (_) {
                return rawUrl;
            }
        }

        // If link is an OpenProcessing sketch URL and doesn't end with "/embed",
        // append "/embed" so it uses the proper embeddable version.
        function normalizeOpenProcessingUrl(rawUrl) {
            try {
                const urlStr = String(rawUrl);
                const lower = urlStr.toLowerCase();
                if (!lower.includes("openprocessing")) return rawUrl;

                const u = new URL(urlStr);
                // Only adjust sketch pages; preserve other paths
                const isSketchPath = /\/sketch\//.test(u.pathname);
                if (isSketchPath && !u.pathname.endsWith("/embed")) {
                    // Ensure single slash when appending
                    u.pathname = u.pathname.replace(/\/$/, "") + "/embed";
                }
                return u.toString();
            } catch (_) {
                return rawUrl;
            }
        }

        // iframe attributes
        const sketchH = sketchInfo.height + 52; // account for p5js editor header
        const iframePermissions = `frameborder="0" scrolling="auto" allow="accelerometer; ambient-light-sensor; autoplay; bluetooth; camera; encrypted-media; geolocation; gyroscope;     hid; microphone; magnetometer; midi; payment; usb; serial; vr; xr-spatial-tracking"`;
        const iframeSize = `width="${sketchInfo.width}" height="${sketchH}"`;

        // scale down for too-tall sketches
        // TODO: handle wide sketches too
        let iframeScale = "";
        if (sketchInfo.height > window.innerHeight - 80) {
            const scaleFactor = ((window.innerHeight - 80) / sketchInfo.height) * 0.9;
            iframeScale = `transform: scale(${scaleFactor});`;
        }

        if (sketchInfo.width > window.innerWidth - 20) {
            const scaleFactor = ((window.innerWidth - 20) / sketchInfo.width) * 0.9;
            iframeScale = `transform: scale(${scaleFactor});`;
        }

        // build nave
        let sketchesMenu = Config.sketches
            .map((s) => {
                return /*html*/ `
        <li>
          <a class="${s.slug === sketchId ? "active" : ""}" href="#${encodeURIComponent(s.slug)}">${s.title}</a>
          by ${s.author}
        </li>
      `;
            })
            .join("");

        // Determine CSS class based on URL
        const isOpenProcessing = sketchInfo.url.includes("openprocessing.org");
        const embedClass = isOpenProcessing ? "openprocessing" : "other";

        // build output markup
        const embedUrl = normalizeOpenProcessingUrl(normalizeP5Url(sketchInfo.url));
        let output = /*html*/ `
      <main-nav class="init">
        <menu-icon></menu-icon>
        <menu-attribution><b>${sketchInfo.title}</b><br>by ${sketchInfo.author}</menu-attribution>
        <section>
          <h1>Creative Coding Class Showcase</h1>
          <small>By students at the Özyeğin University, Communication Design Department, Fall 2025.</small>
          <nav>
            <ul>
              ${sketchesMenu}
            </ul>
          </nav>
        </section>
      </main-nav>
      <sketch-display>
        <p5-embed class="${embedClass}" style="width: ${sketchInfo.width}px; height: ${
            sketchInfo.height
        }px; ${iframeScale}">
                    <loading-message>
                        <div class="loader">
                            <p class="heading">Loading</p>
                            <div class="loading">
                                <div class="load"></div>
                                <div class="load"></div>
                                <div class="load"></div>
                                <div class="load"></div>
                            </div>
                        </div>
                    </loading-message>
          <iframe ${iframeSize} src="${embedUrl}" ${iframePermissions}></iframe>
        </p5-embed>
      </sketch-display>
      <style>${this.css()}</style>
    `;
        // write to DOM
        this.innerHTML = output;

        // check for iframe loaded
        const iframe = this.querySelector("iframe");
        iframe.onload = () => {
            // console.log("iframe loaded", Date.now());
            setTimeout(() => {
                // console.log("iframe reveal", Date.now());
                this.querySelector("p5-embed").classList.add("loaded");
            }, 1200);
        };

        // remove init class after delay
        setTimeout(() => {
            this.querySelector("main-nav").classList.remove("init");
        }, 500);

        // add click event listener to menu icon
        const menuIcon = this.querySelector("menu-icon");
        const mainNav = this.querySelector("main-nav");

        menuIcon.addEventListener("click", (e) => {
            e.preventDefault();
            mainNav.classList.toggle("open");
        });

        // close menu when clicking on sketch-display
        const sketchDisplay = this.querySelector("sketch-display");
        sketchDisplay.addEventListener("click", () => {
            mainNav.classList.remove("open");
        });
    }
}
customElements.define("app-root", AppRoot);

export default AppRoot;
