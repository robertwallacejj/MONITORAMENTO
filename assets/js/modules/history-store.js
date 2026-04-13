
(function () {
  "use strict";

  const DB_NAME = "monitoramento_reports_db";
  const DB_VERSION = 1;
  const STORE_NAME = "snapshots";

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in window)) {
        reject(new Error("IndexedDB não suportado neste navegador."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        const db = event.target.result;
        let store;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        } else {
          store = event.target.transaction.objectStore(STORE_NAME);
        }

        if (!store.indexNames.contains("savedAt")) store.createIndex("savedAt", "savedAt", { unique: false });
        if (!store.indexNames.contains("signature")) store.createIndex("signature", "signature", { unique: false });
        if (!store.indexNames.contains("referenceDate")) store.createIndex("referenceDate", "referenceDate", { unique: false });
      };

      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Falha ao abrir o banco local.")); };
    });
  }

  function withStore(mode, handler) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = handler(store, tx, db);

        tx.oncomplete = function () {
          db.close();
          resolve(result);
        };
        tx.onerror = function () {
          db.close();
          reject(tx.error || new Error("Falha na transação do banco local."));
        };
        tx.onabort = function () {
          db.close();
          reject(tx.error || new Error("Transação abortada no banco local."));
        };
      });
    });
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error || new Error("Falha ao consultar o banco local.")); };
    });
  }

  function slug(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "snapshot";
  }

  function hashString(str) {
    let hash = 5381;
    const text = String(str || "");
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) + hash) + text.charCodeAt(i);
      hash = hash >>> 0;
    }
    return hash.toString(16);
  }

  function getReferenceDate(lastUpdate) {
    const d = lastUpdate ? new Date(lastUpdate) : new Date();
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  }

  function buildSignature(payload) {
    const basis = {
      fileNames: (payload.fileNames || []).slice().sort(),
      rowCount: Number(payload.rowCount || 0),
      totalBases: Number(payload.summary && payload.summary.totalBases || 0),
      totalExpedido: Number(payload.summary && payload.summary.totalExpedido || 0),
      totalEntregue: Number(payload.summary && payload.summary.totalEntregue || 0),
      totalInsucesso: Number(payload.summary && payload.summary.totalInsucesso || 0),
      baseMetrics: (payload.baseMetrics || []).map(function (item) {
        return [item.base, item.total, item.entregue, item.insucesso, item.pendente, item.taxa];
      })
    };

    return hashString(JSON.stringify(basis));
  }

  function normalizeSnapshot(payload) {
    const savedAt = payload.savedAt || new Date().toISOString();
    const lastUpdate = payload.lastUpdate || savedAt;
    const signature = payload.signature || buildSignature(payload);
    return Object.assign({}, payload, {
      id: payload.id || (savedAt.replace(/[:.]/g, "-") + "-" + slug(signature)),
      savedAt: savedAt,
      lastUpdate: lastUpdate,
      referenceDate: payload.referenceDate || getReferenceDate(lastUpdate),
      signature: signature,
      fileCount: Number(payload.fileCount || (payload.fileNames || []).length || 0),
      fileNames: Array.isArray(payload.fileNames) ? payload.fileNames : [],
      rowCount: Number(payload.rowCount || 0),
      summary: payload.summary || {},
      baseMetrics: Array.isArray(payload.baseMetrics) ? payload.baseMetrics : [],
      drivers: Array.isArray(payload.drivers) ? payload.drivers : []
    });
  }

  async function getBySignature(signature) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("signature");
      const all = await requestToPromise(index.getAll(signature));
      return (all || []).sort(function (a, b) { return String(b.savedAt).localeCompare(String(a.savedAt)); })[0] || null;
    } finally {
      db.close();
    }
  }

  async function saveSnapshot(payload) {
    const snapshot = normalizeSnapshot(payload);
    const existing = await getBySignature(snapshot.signature);

    if (existing) {
      return {
        ok: true,
        status: "duplicate",
        snapshot: existing
      };
    }

    await withStore("readwrite", function (store) {
      store.put(snapshot);
    });

    return {
      ok: true,
      status: "created",
      snapshot: snapshot
    };
  }

  async function getSnapshotById(id) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      return await requestToPromise(store.get(id));
    } finally {
      db.close();
    }
  }

  async function listSnapshots(filters) {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const all = await requestToPromise(store.getAll());
      const opts = filters || {};
      const start = opts.start ? new Date(opts.start).getTime() : null;
      const end = opts.end ? new Date(opts.end).getTime() : null;
      const base = String(opts.base || "all").trim();
      const search = String(opts.search || "").trim().toLowerCase();

      return (all || []).filter(function (item) {
        const when = new Date(item.savedAt).getTime();
        if (start && when < start) return false;
        if (end && when > end) return false;
        if (base !== "all") {
          const hasBase = (item.baseMetrics || []).some(function (metric) { return metric.base === base; });
          if (!hasBase) return false;
        }
        if (search) {
          const haystack = [item.id, item.referenceDate].concat(item.fileNames || []).join(" ").toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      }).sort(function (a, b) {
        return String(b.savedAt).localeCompare(String(a.savedAt));
      });
    } finally {
      db.close();
    }
  }

  async function deleteSnapshot(id) {
    await withStore("readwrite", function (store) {
      store.delete(id);
    });
    return true;
  }

  async function clearAllSnapshots() {
    await withStore("readwrite", function (store) {
      store.clear();
    });
    return true;
  }

  async function getStats() {
    const list = await listSnapshots();
    const latest = list[0] || null;
    return {
      totalSnapshots: list.length,
      latestSnapshot: latest,
      totalBases: latest && latest.summary ? Number(latest.summary.totalBases || 0) : 0
    };
  }

  window.CTReportStore = {
    openDb: openDb,
    saveSnapshot: saveSnapshot,
    getSnapshotById: getSnapshotById,
    listSnapshots: listSnapshots,
    deleteSnapshot: deleteSnapshot,
    clearAllSnapshots: clearAllSnapshots,
    getStats: getStats,
    buildSignature: buildSignature
  };
})();
