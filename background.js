"use strict";

let isStartup = false;

// Cache of locked origins: maps tabId -> origin string
// Rebuilt from config + active tabs whenever config changes
const lockedTabs = new Map();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getConfig() {
  return browser.storage.sync.get({ tabs: [] });
}

async function openTabs(tabConfigs, windowId) {
  // Pinned tabs first for correct left-to-right ordering
  const sorted = [
    ...tabConfigs.filter(t => t.pinned),
    ...tabConfigs.filter(t => !t.pinned),
  ];

  for (const tabConfig of sorted) {
    try {
      await browser.tabs.create({
        url: tabConfig.url,
        pinned: tabConfig.pinned,
        active: false,
        windowId: windowId,
      });
    } catch (err) {
      console.error(`Tab Ritual: Failed to open ${tabConfig.url}:`, err);
    }
  }
}

// --- Origin locking for pinned tabs ---

// Build a set of locked origins from config
function getLockedOrigins(configTabs) {
  const origins = new Set();
  for (const t of configTabs) {
    if (t.lockOrigin && t.pinned) {
      try {
        origins.add(new URL(t.url).origin);
      } catch {}
    }
  }
  return origins;
}

// Rebuild the lockedTabs map by checking all open pinned tabs
// against the configured locked origins
async function rebuildLockedTabs() {
  lockedTabs.clear();
  const { tabs: configTabs } = await getConfig();
  const lockedOrigins = getLockedOrigins(configTabs);
  if (lockedOrigins.size === 0) return;

  const allPinnedTabs = await browser.tabs.query({ pinned: true });
  for (const tab of allPinnedTabs) {
    try {
      const origin = new URL(tab.url).origin;
      if (lockedOrigins.has(origin)) {
        lockedTabs.set(tab.id, origin);
      }
    } catch {}
  }
}

// Track when tabs are created/updated/pinned to maintain the lock cache
browser.tabs.onCreated.addListener(async (tab) => {
  if (!tab.pinned || !tab.url) return;
  const { tabs: configTabs } = await getConfig();
  const lockedOrigins = getLockedOrigins(configTabs);
  try {
    const origin = new URL(tab.url).origin;
    if (lockedOrigins.has(origin)) {
      lockedTabs.set(tab.id, origin);
    }
  } catch {}
});

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // If pin state changed, update cache
  if (changeInfo.pinned === true) {
    const { tabs: configTabs } = await getConfig();
    const lockedOrigins = getLockedOrigins(configTabs);
    try {
      const origin = new URL(tab.url).origin;
      if (lockedOrigins.has(origin)) {
        lockedTabs.set(tabId, origin);
      }
    } catch {}
  } else if (changeInfo.pinned === false) {
    lockedTabs.delete(tabId);
  }
});

browser.tabs.onRemoved.addListener((tabId) => {
  lockedTabs.delete(tabId);
});

// Rebuild cache when settings change
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.tabs) {
    rebuildLockedTabs();
  }
});

// Block cross-origin navigations in locked pinned tabs
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const lockedOrigin = lockedTabs.get(details.tabId);
    if (!lockedOrigin) return;

    try {
      const targetOrigin = new URL(details.url).origin;
      if (targetOrigin !== lockedOrigin) {
        console.log(`Tab Ritual: Blocked navigation to ${details.url} (locked to ${lockedOrigin})`);
        return { cancel: true };
      }
    } catch {}
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking"]
);

// --- Browser startup ---
browser.runtime.onStartup.addListener(async () => {
  isStartup = true;
  setTimeout(() => { isStartup = false; }, 3000);

  await rebuildLockedTabs();

  const { tabs } = await getConfig();
  const startupTabs = tabs.filter(t => t.onStartup);
  if (startupTabs.length === 0) return;

  // Wait for Firefox to finish creating the initial window
  await delay(500);

  const windows = await browser.windows.getAll({ windowTypes: ["normal"] });
  if (windows.length === 0) return;

  const targetWindow = windows[windows.length - 1];
  await openTabs(startupTabs, targetWindow.id);
});

// --- New window ---
browser.windows.onCreated.addListener(async (window) => {
  if (isStartup) return;
  if (window.type !== "normal") return;

  const { tabs } = await getConfig();
  const newWindowTabs = tabs.filter(t => t.onNewWindow);
  if (newWindowTabs.length === 0) return;

  // Brief delay for window to finish initializing
  await delay(200);

  await openTabs(newWindowTabs, window.id);
});

// Init on load (handles temporary add-on installs during development)
rebuildLockedTabs();
