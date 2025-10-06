(function() {
  const DB_NAME = "yt_endscreen_db";
  const STORE_NAME = "walls5";
  const timestamp_norfac = parseInt(STORE_NAME.match(/[1-9]\d*$/)[0], 10) * 1000;
  const MAX_DAYS = 7;

  // --- IndexedDB setup ---
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
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
    // toggleArchivedVideoWalls(true);
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
  const STORE_NAME = "walls5";
  const timestamp_norfac = parseInt(STORE_NAME.match(/[1-9]\d*$/)[0], 10) * 1000;
  const BATCH_SIZE = 5;

  let allWalls = [], currentIndex = 0;

  function toggleArchivedVideoWalls(reload=false) {
    if (reload) {
      allWalls = []; currentIndex = 0;
    }
    const existing = document.getElementById("yt-vw-overlay");
    if (existing) {
      if (reload) {
        existing.remove();
      } else {
        if (existing.style.display === "none") {
          existing.style.display = "block";
        } else {
          existing.style.display = "none";
        }
        return;
      }
    }

    const req = indexedDB.open(DB_NAME, 2);
    req.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        allWalls = req.result.sort((a, b) => b.timestamp - a.timestamp);  // newest first
        if (allWalls.length === 0) {
          alert("ℹ️ No endscreen archives found.");
          return;
        }
        showOverlay();
        loadBatch();
        updateCounter();
      };
    };
    req.onerror = () => alert("❌ Failed to open DB");
  }

  function showOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "yt-vw-overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "20px",
      left: "20px",
      right: "20px",
      bottom: "20px",
      background: "white",
      zIndex: 999999,
      overflow: "auto",
      border: "2px solid #333",
      padding: "55px 20px 25px",  // space for fixed header/footer
      fontFamily: "sans-serif",
      fontSize: "13px",
      color: "#222",
      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
    });

    // Title (fixed top-left)
    const title = document.createElement("div");
    title.textContent = "📺 YouTube Player Endscreen Videowall Archive";
    Object.assign(title.style, {
      position: "fixed",
      top: "40px",
      left: "40px",
      insetInlineEnd: "40px",
      fontSize: "18px",
      fontWeight: "bold",
      marginBottom: "8px",
      padding: "5px 10px",
      background: "dodgerblue",
      color: "white",
    });
    overlay.appendChild(title);

    // Counter (fixed top-right)
    const counter = document.createElement("span");
    counter.id = "yt-vw-counter";
    Object.assign(counter.style, {
      fontSize: "14px",
      position: "absolute",
      right: "10px",
      top: "50%",
      transform: "translateY(-50%)",
    });
    title.appendChild(counter);

    // Container for walls
    const container = document.createElement("div");
    container.id = "yt-vw-walls";
    overlay.appendChild(container);

    // Controls (bottom fixed)
    const controls = document.createElement("div");
    controls.id = "yt-vw-controls";
    Object.assign(controls.style, {
      position: "fixed",
      bottom: "30px",
      left: "50%",
      transform: "translateX(-50%)",
    });

    const btnLoadMore = document.createElement("button");
    btnLoadMore.id = "btn-load-more";
    btnLoadMore.textContent = "⬇️ Load More";
    btnLoadMore.onclick = loadBatch;
    controls.appendChild(btnLoadMore);

    const btnLoadAll = document.createElement("button");
    btnLoadAll.id = "btn-load-all";
    btnLoadAll.textContent = "📜 Load All";
    btnLoadAll.style.marginLeft = "10px";
    btnLoadAll.onclick = loadAll;
    controls.appendChild(btnLoadAll);

    const btnRefresh = document.createElement("button");
    btnRefresh.textContent = "🔁 Refresh";
    btnRefresh.style.marginLeft = "10px";
    btnRefresh.onclick = () => toggleArchivedVideoWalls(true);
    controls.appendChild(btnRefresh);

    const btnClose = document.createElement("button");
    btnClose.textContent = "❌ Close";
    btnClose.style.marginLeft = "10px";
    btnClose.onclick = () => overlay.style.display = "none";
    controls.appendChild(btnClose);

    overlay.appendChild(controls);
    document.body.appendChild(overlay);
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleString();
  }

  function renderWall(wall, index) {
    const wrapper = document.createElement("div");
    Object.assign(wrapper.style, {
      margin: "15px 0",
      padding: "10px",
      border: "1px solid #444",
      borderRadius: "8px",
    });

    // Timestamp bar (full-width)
    const ts = document.createElement("div");
    const date = formatDate(wall.timestamp * timestamp_norfac);
    ts.textContent = `Captured at ${date} (video ${wall.videoId})`;
    Object.assign(ts.style, {
      background: "mediumseagreen",
      padding: "5px 10px",
      fontSize: "13px",
      fontWeight: "bold",
      marginBottom: "8px",
      position: "relative",
    });
    const wi = document.createElement("span");
    wi.textContent = `( ${index} / ${allWalls.length} )`;
    Object.assign(wi.style, {
      position: "absolute",
      right: "10px",
    });
    ts.appendChild(wi);
    wrapper.appendChild(ts);

    // Grid of thumbnails
    const grid = document.createElement("div");
    const colCount = wall.colCount || 3;
    const rowCount = Math.ceil(wall.items.length / colCount);
    Object.assign(grid.style, {
      display: "grid",
      gridTemplateColumns: `repeat(${colCount}, 1fr)`,
      gap: "8px",
    });

    wall.items.forEach((item, i) => {
      const r = (i % rowCount) + 1;
      const c = Math.floor(i / rowCount) + 1;

      const cell = document.createElement("div");
      Object.assign(cell.style, {
        border: "1px solid #ccc",
        borderRadius: "4px",
        padding: "4px",
        gridRow: r,
        gridColumn: c,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      });

      const link = document.createElement("a");
      link.href = item.link;
      link.target = "_blank";
      Object.assign(link.style, {
        display: "block",
        width: "100%",
        color: "inherit",
        textDecoration: "none",
      });

      const thumb = document.createElement("img");
      const vid = new URLSearchParams(new URL(item.link).search).get("v");
      if (vid) {
        thumb.src = `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`;
        thumb.alt = item.title;
        thumb.loading = "lazy";
        Object.assign(thumb.style, {
          width: "100%",
          height: "auto",
          objectFit: "contain",  // scale down to fit
          borderRadius: "4px",
        });
      }
      link.appendChild(thumb);

      // if (txlog.match(extractVideoId(item.link))) {
      //   const last_tx = getLastRowByVideoId(txlog, extractVideoId(item.link)).match(/(?<=\t)<[^>]+>/)?.toString() || "Oops";
      //   const status_mark = document.createElement("div");
      //   status_mark.textContent = last_tx;
      //   Object.assign(status_mark.style, {
      //     position: "absolute",
      //     top: "0",
      //     background: "white",
      //     color: "black",
      //     padding: "0px 4px 2px 0px",
      //     fontWeight: "bold",
      //   });
      //   link.style.position = "relative";
      //   link.appendChild(status_mark);
      // }

      const title = document.createElement("div");
      title.textContent = item.title;
      Object.assign(title.style, {
        marginTop: "4px",
        fontWeight: "500",
        whiteSpace: "normal",    // allow wrapping
        wordWrap: "break-word",  // break long words
        textAlign: "center",
      });

      const duration = document.createElement("div");
      duration.textContent = item.length ? " " + item.length + " " : "";
      Object.assign(duration.style, {
        color: "white",
        background: "red",
        whiteSpace: "pre",
        marginTop: "auto",
      });

      link.appendChild(title);
      cell.appendChild(link);
      cell.appendChild(duration);
      grid.appendChild(cell);
    });

    wrapper.appendChild(grid);
    return wrapper;
  }

  function loadBatch() {
    const container = document.getElementById("yt-vw-walls");
    const next = allWalls.slice(currentIndex, currentIndex + BATCH_SIZE);
    next.forEach((wall, i) => container.appendChild(renderWall(wall, currentIndex + i + 1)));
    currentIndex += next.length;
    updateCounter();
  }

  function loadAll() {
    const container = document.getElementById("yt-vw-walls");
    while (currentIndex < allWalls.length) {
      container.appendChild(renderWall(allWalls[currentIndex++], currentIndex));
    }
    updateCounter();
  }

  function updateCounter() {
    const counter = document.getElementById("yt-vw-counter");
    if (counter) {
      counter.textContent = `loaded ${currentIndex} of ${allWalls.length}`;
    }

    // Hide Load More if no more batches
    const btnMore = document.getElementById("btn-load-more");
    if (btnMore) {
      btnMore.style.display = currentIndex < allWalls.length ? "inline-block" : "none";
    }

    // Hide Load All if already fully loaded
    const btnAll = document.getElementById("btn-load-all");
    if (btnAll) {
      btnAll.style.display = currentIndex < allWalls.length ? "inline-block" : "none";
    }
  }

  // function getLastRowByVideoId(text, videoId) {
  //   const pattern = new RegExp(`^.*${videoId}.*$`, 'gm');
  //   const matches = text.match(pattern);
  //   return matches ? matches[matches.length - 1] : null;
  // }

  // toggle on keypress "r"
  document.addEventListener("keydown", e => {
    if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.altKey && !e.metaKey) {
      toggleArchivedVideoWalls();
    } else if (e.keyCode === 27 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      const existing = document.getElementById("yt-vw-overlay");
      if (existing) {
        existing.style.display = "none";
      }
    }
  });

  window.toggleArchivedVideoWalls = toggleArchivedVideoWalls;
})();
