(function() {
  const DB_NAME = "yt_endscreen_db";
  const STORE_NAME = "walls";
  const MAX_DAYS = 7;

  // --- IndexedDB setup ---
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        db.createObjectStore(STORE_NAME, { keyPath: ["timestamp", "videoId"] });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function saveWall(data) {
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(data);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    });
  }

  function normalizeTimestamp(ms) {
    // Round to nearest second (if the timestamp normalization factor is set to 1000)
    return Math.round(ms / timestamp_norfac);
  }

  function cleanup() {
    const cutoff = normalizeTimestamp(Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000);
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            if (cursor.value.timestamp < cutoff) {
              cursor.delete();
            }
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => reject(req.error);
      });
    });
  }

  const d = document;  // you may want to adjust this to fit your application, for instance, maybe inside an iframe like `const d = document.querySelector("iframe").contentDocument;`

  // --- Capture the wall ---
  function captureWall() {
    const wallItems = d.querySelectorAll(".ytp-videowall-still");
    if (!wallItems.length) return;

    const data = {
      timestamp: normalizeTimestamp(Date.now()),
      videoId: new URLSearchParams(location.search).get("v") || "",
      colCount: (() => {
        const first = wallItems[0]?.getBoundingClientRect();
        if (!first) return 4;
        const rowTops = [...wallItems].map(el => el.getBoundingClientRect().top);
        const firstRowTop = rowTops[0];
        return rowTops.filter(t => Math.abs(t - firstRowTop) < 5).length;
      })(),
      items: Array.from(wallItems).map(el => {
        const link = el.href || "";
        const title = (el.ariaLabel?.startsWith("Watch ") ? el.ariaLabel.slice(6) : el.ariaLabel) || "";
        const length = el.querySelector(".ytp-videowall-still-info-duration")?.innerText || "";
        return { link, title, length };
      })
    };

    saveWall(data).then(cleanup);
    console.log("🎉 Captured video wall:", data);
    // window.getAllWalls().then(window.renderWalls);
  }

  (function waitForPlayer() {
    const player = d.querySelector("#movie_player");
    if (!player || !player.addEventListener) {
      setTimeout(waitForPlayer, 500);
      return;
    }

    // this trigger is more robust than "video ended", coz youtube itself actually uses this event for inserting endscreen videowall
    player.addEventListener("onStateChange", (state) => {
      if (state === 0) {
        // Give YouTube a moment to render the wall
        setTimeout(captureWall, 1000);
      }
    });
})();


(function () {
  const DB_NAME = "yt_endscreen_db";
  const STORE_NAME = "walls";
  const OVERLAY_ID = "yt-wall-overlay";

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function getAllWalls() {
    return openDB().then(db => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    });
  }

  function renderWalls(walls) {
    // remove if already exists
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
      return;  // toggle off
    }

    // --- overlay container ---
    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.position = "fixed";
    overlay.style.top = "20px";
    overlay.style.left = "20px";
    overlay.style.right = "20px";
    overlay.style.bottom = "20px";
    overlay.style.background = "white";
    overlay.style.zIndex = 999999;
    overlay.style.overflow = "auto";
    overlay.style.border = "2px solid #333";
    overlay.style.padding = "10px";
    overlay.style.fontFamily = "sans-serif";
    overlay.style.fontSize = "13px";
    overlay.style.color = "#222";
    overlay.style.boxShadow = "0 0 15px rgba(0,0,0,0.5)";

    // sticky close button
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✖";
    closeBtn.style.position = "sticky";
    closeBtn.style.float = "right";
    closeBtn.style.top = "0";
    closeBtn.style.right = "0";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.zIndex = "1000000";
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);

    // add each wall
    walls.sort((a, b) => b.timestamp - a.timestamp);  // newest first
    walls.forEach(wall => {
      const section = document.createElement("div");
      section.style.marginBottom = "20px";

      const header = document.createElement("div");
      const date = new Date(wall.timestamp * timestamp_norfac).toLocaleString();
      header.textContent = `Captured at ${date} (video ${wall.videoId})`;
      header.style.fontWeight = "bold";
      header.style.marginBottom = "8px";
      section.appendChild(header);

      const grid = document.createElement("div");
      const colCount = wall.colCount || 3;
      const rowCount = Math.ceil(wall.items.length / colCount);

      grid.style.display = "grid";
      grid.style.gridTemplateColumns = `repeat(${colCount}, 1fr)`;
      grid.style.gap = "8px";

      wall.items.forEach((item, i) => {
        const r = (i % rowCount) + 1;
        const c = Math.floor(i / rowCount) + 1;

        const cell = document.createElement("div");
        cell.style.border = "1px solid #ccc";
        cell.style.padding = "4px";
        cell.style.background = "#fafafa";
        cell.style.gridRow = r;
        cell.style.gridColumn = c;
        cell.style.display = "flex";
        cell.style.flexDirection = "column";
        cell.style.alignItems = "center";

        // clickable thumbnail
        const link = document.createElement("a");
        link.href = item.link;
        link.target = "_blank";
        link.style.display = "block";
        link.style.width = "100%";

        const thumb = document.createElement("img");
        const vid = new URLSearchParams(new URL(item.link).search).get("v");
        if (vid) {
          thumb.src = `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
          thumb.style.width = "100%";
          thumb.style.height = "auto";
          thumb.style.objectFit = "contain";  // scale down to fit
        }
        link.appendChild(thumb);

        // if (txlog.match(extractVideoId(item.link))) {
        //   const last_tx = getLastRowByVideoId(txlog, extractVideoId(item.link)).match(/(?<=\t)<[^>]+>/)?.toString() || "Oops";
        //   const status_mark = document.createElement("div");
        //   status_mark.textContent = last_tx;
        //   status_mark.style.position = "absolute";
        //   status_mark.style.top = "0";
        //   status_mark.style.background = "white";
        //   status_mark.style.color = "black";
        //   status_mark.style.padding = "0px 4px 2px 0px";
        //   status_mark.style.fontWeight = "bold";
        //   link.style.position = "relative";
        //   link.appendChild(status_mark);
        // }

        const title = document.createElement("a");
        title.textContent = item.title || "(untitled)";
        title.style.marginTop = "4px";
        title.style.fontWeight = "500";
        title.style.whiteSpace = "normal";    // allow wrapping
        title.style.wordWrap = "break-word";  // break long words
        title.style.textAlign = "center";
        title.style.color = "inherit";
        title.style.textDecoration = "none";
        title.href = item.link;

        const duration = document.createElement("div");
        duration.textContent = item.length ? " " + item.length + " " : "";
        // duration.style.fontSize = "11px";
        // duration.style.color = "#555";
        duration.style.color = "white";
        duration.style.background = "red";
        duration.style.whiteSpace = "pre";
        duration.style.marginTop = "auto";

        cell.appendChild(link);
        cell.appendChild(title);
        cell.appendChild(duration);

        grid.appendChild(cell);
      });

      section.appendChild(grid);
      overlay.appendChild(section);
    });

    document.body.appendChild(overlay);
  }

  // function getLastRowByVideoId(text, videoId) {
  //   const pattern = new RegExp(`^.*${videoId}.*$`, 'gm');
  //   const matches = text.match(pattern);
  //   return matches ? matches[matches.length - 1] : null;
  // }

  // toggle on keypress "r"
  document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      getAllWalls().then(renderWalls);
    }
  });

  window.getAllWalls = getAllWalls;
  window.renderWalls = renderWalls;
})();
var timestamp_norfac = 5000;
