# YouTube End-Screen Capture Script
Automatically capture and save YouTube end-screen video suggestions for later viewing. Stores them in IndexedDB with configurable retention and an easy retrieval UI.

Most YouTube videos end with an *end-screen video wall*: a grid of suggested videos to watch next. Usually, we glance at it—or ignore it—and then close the page. But sometimes, just as the page is gone, you realize something from that fleeting glance caught your interest. By then it’s too late: replaying the same video doesn’t always bring back the same set of suggestions.

Even if you do want to explore the recommendations, you often don’t have the time right then.

This script solves that problem.  
It automatically captures every end-screen video wall shown inside a YouTube player, storing the suggestions for later. Records are kept for **7 days by default** (configurable), and older entries are automatically removed. With this in place, you can revisit those end-screen suggestions at your convenience—without worrying about losing them forever.

---

## ✨ Features

- 🔄 **Automatic capture** of YouTube end-screen video walls  
- ⏱ **Configurable retention** (default: 7 days)  
- 🧹 **Automatic cleanup** of expired records  
- 📂 **IndexedDB storage** inside the browser — no server required  
- 🔍 **Retrieval script included** to browse your captured suggestions in reverse chronological order  

---

## 📦 Installation

1. Clone this repository or copy the script files directly.  

2. Load the script into your browser. You can:

   - Run it as a userscript with Tampermonkey / Violentmonkey

   - Or inject it manually into the console for testing

   - Or by the bookmarklet way

---

## 🚀 Usage

1. Play any YouTube video as usual.

2. When the video ends, the script will automatically capture the end-screen suggestions.

3. Press `R`/`r` (on your keyboard) to toggle show/hide of the records.

   - Entries are listed in reverse chronological order.

   - Each record shows the video wall and links directly to the suggested videos.

---

## ⚙ Configuration

### Inside the script you’ll find a setting:
```js
  const MAX_DAYS = 7;
```
   - Change this number to keep entries for a different length of time.
Older records are automatically deleted during cleanup.

### Inside the script, locate this line:
```js
    if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.altKey && !e.metaKey) {
```
   - Change the `"r"` to whatever your desired keyboard shortcut to be.

---

## 🧹 Data Retention & Cleanup

- Records are stored in IndexedDB under a dedicated database.

- Each capture is timestamped and indexed for efficient retrieval.

- A built-in cleanup routine ensures expired entries are purged whenever a capture is saved.

---

## 🐞 Troubleshooting

- Not seeing captures?
  Ensure your userscript manager is enabled on YouTube pages.

- Database stuck or corrupted?

  - Delete the database via DevTools → Application → IndexedDB

  - Or run `indexedDB.deleteDatabase("yt_endscreen_db")` in the console

  - If issues persist, restart the browser and retry

---

## 💡 Tip

If necessary (for cases where only one of them is needed), you can easily split the script into two: one for capturing, and one for retrieval.

~~**Note:** Please make sure each script, after the split, has its own "timestamp normalization factor" (for instance, `var timestamp_norfac = 5000;`), and they must be identical.~~

---

## 🛠️ IndexedDB Refactor Notes: Renaming Stores Without Breaking Things

Either deleting it or converting it. And make sure you do either one of them before you deploy the new code.
### To delete, execute this
```js
(function() {
  const DB_NAME = "yt_endscreen_db";
  const req = indexedDB.deleteDatabase(DB_NAME);

  req.onsuccess = function() {
    alert("✅ Database deleted successfully:", DB_NAME);
  };

  req.onerror = function(e) {
    alert("❌ Failed to delete database:", e.target.error);
  };

  req.onblocked = function() {
    alert("⚠️ Delete blocked. Close other tabs or reload.");
  };
})();
```
### To convert, execute this (change the version number to match the latest one if it's no longer `2` as stated)
```js
(function() {
  const dbName = "yt_endscreen_db";
  const oldStore = "walls";
  const newStore = "walls5";
  const newVersion = 2;

  const request = indexedDB.open(dbName, newVersion);

  request.onupgradeneeded = function(event) {
    const db = event.target.result;
    const tx = event.target.transaction;

    // Create new store if it doesn't exist
    if (!db.objectStoreNames.contains(newStore)) {
      const newObjStore = db.createObjectStore(newStore, { keyPath: ["timestamp", "videoId"] });

      // Copy data from old store
      if (db.objectStoreNames.contains(oldStore)) {
        const oldObjStore = tx.objectStore(oldStore);
        oldObjStore.getAll().onsuccess = function(e) {
          const records = e.target.result;
          for (const record of records) {
            newObjStore.add(record);
          }
        };

        // Delete old store
        db.deleteObjectStore(oldStore);
      }
    }
  };

  request.onsuccess = function() {
    alert("✅ Store renamed from 'walls' to 'walls5' in version 2.");
    request.result.close();
  };

  request.onerror = function() {
    alert("❌ Failed to open database:", request.error);
  };
})();
```

---

# If you appreciate my work, i will be very grateful if you can support my work by making small sum donation thru PayPal with `Send payment to` entered as `headwindtrend@gmail.com`. Thank you very much for your support.
