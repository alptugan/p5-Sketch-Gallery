import Config from "./config.js";

class App extends HTMLElement {
    connectedCallback() {
        requestAnimationFrame(() => this.render()); // solves circular import race condition
        addEventListener("hashchange", (event) => window.location.reload());
    }

    disconnectedCallback() {}

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

    render() {
        // Parse hash for week and sketch: #week2 or #week2/sketch-slug
        const rawHash = window.location.hash.substring(1);
        const parts = rawHash.split("/");
        let weekId = parts[0] ? decodeURIComponent(parts[0]) : "";
        let sketchSlug = parts[1] ? decodeURIComponent(parts[1]) : "";

        // If no week specified, redirect to default week
        if (!weekId) {
            const defaultFolder = Config.folders.find((f) => f.isDefault) || Config.folders[0];
            if (defaultFolder) {
                window.location.hash = defaultFolder.id;
                return;
            }
        }

        // Validate week exists
        const currentFolder = Config.folders.find((f) => f.id === weekId);
        if (!currentFolder) {
            // Invalid week, redirect to default
            const defaultFolder = Config.folders.find((f) => f.isDefault) || Config.folders[0];
            if (defaultFolder) {
                window.location.hash = defaultFolder.id;
                return;
            }
        }

        // Filter sketches for current week
        const weekSketches = Config.sketches.filter((s) => s.week === weekId);

        // If no sketch specified, pick first one in this week
        if (!sketchSlug && weekSketches.length > 0) {
            window.location.hash = `${weekId}/${encodeURIComponent(weekSketches[0].slug)}`;
            return;
        }

        // Handle empty week
        if (weekSketches.length === 0) {
            this.renderEmptyWeek(weekId, currentFolder);
            return;
        }

        // Find the sketch
        const sketchInfo = weekSketches.find((s) => s.slug === sketchSlug);

        // Fallback if sketch not found in this week
        if (!sketchInfo) {
            window.location.hash = `${weekId}/${encodeURIComponent(weekSketches[0].slug)}`;
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
        let sketchesMenu = weekSketches
            .map((s) => {
                return /*html*/ `
        <li>
          <a class="${s.slug === sketchSlug ? "active" : ""}" href="#${weekId}/${encodeURIComponent(s.slug)}">${
                    s.title
                }</a>
          by ${s.author}
        </li>
      `;
            })
            .join("");

        // Build week selector dropdown
        let weekSelector = /*html*/ `
      <div class="week-selector">
        <label for="week-select">Choose The Topic</label>
        <select id="week-select" onchange="window.location.hash = this.value">
          ${Config.folders
              .map(
                  (folder) => /*html*/ `
            <option value="${folder.id}" ${folder.id === weekId ? "selected" : ""}>
              ${folder.name}
            </option>
          `
              )
              .join("")}
        </select>
      </div>
    `;

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
          ${weekSelector}
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

    renderEmptyWeek(weekId, currentFolder) {
        // Build week selector dropdown
        let weekSelector = /*html*/ `
      <div class="week-selector">
        <label for="week-select">Week:</label>
        <select id="week-select" onchange="window.location.hash = this.value">
          ${Config.folders
              .map(
                  (folder) => /*html*/ `
            <option value="${folder.id}" ${folder.id === weekId ? "selected" : ""}>
              ${folder.name}
            </option>
          `
              )
              .join("")}
        </select>
      </div>
    `;

        let output = /*html*/ `
      <main-nav class="init">
        <menu-icon></menu-icon>
        <menu-attribution><b>${currentFolder.name}</b></menu-attribution>
        <section>
          <h1>Creative Coding Class Showcase</h1>
          <small>By students at the Özyeğin University, Communication Design Department, Fall 2025.</small>
          ${weekSelector}
          <nav>
            <div class="empty-week-message">
              <p>No sketches yet for ${currentFolder.name}.</p>
              <p>Check back soon!</p>
            </div>
          </nav>
        </section>
      </main-nav>
      <sketch-display>
        <div class="empty-week-display">
          <h2>No sketches available</h2>
          <p>This week doesn't have any sketches yet.</p>
          <p>Students can upload their work through the admin panel.</p>
        </div>
      </sketch-display>
      <style>${this.css()}</style>
    `;

        this.innerHTML = output;

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

customElements.define("custom-app", App);

export default App;
