"use strict";

let isStartup = false;

// Track pinned tabs so we can reopen them if closed
// Maps tabId -> { url, windowId }
const pinnedTabCache = new Map();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getConfig() {
  return browser.storage.sync.get({ tabs: [], protectPinned: false });
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

// --- Pinned tab protection ---
// Build initial cache of all pinned tabs on extension load
async function initPinnedTabCache() {
  const allTabs = await browser.tabs.query({ pinned: true });
  for (const tab of allTabs) {
    pinnedTabCache.set(tab.id, { url: tab.url, windowId: tab.windowId });
  }
}

// Track pinned state changes
browser.tabs.onCreated.addListener((tab) => {
  if (tab.pinned) {
    pinnedTabCache.set(tab.id, { url: tab.url, windowId: tab.windowId });
  }
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.pinned) {
    pinnedTabCache.set(tabId, { url: tab.url, windowId: tab.windowId });
  } else {
    pinnedTabCache.delete(tabId);
  }
});

// Reopen pinned tabs when closed (if protection enabled)
browser.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const cached = pinnedTabCache.get(tabId);
  pinnedTabCache.delete(tabId);

  if (!cached) return;
  if (removeInfo.isWindowClosing) return;

  const { protectPinned } = await getConfig();
  if (!protectPinned) return;

  try {
    await browser.tabs.create({
      url: cached.url,
      pinned: true,
      active: false,
      windowId: cached.windowId,
    });
  } catch (err) {
    console.error(`Tab Ritual: Failed to restore pinned tab ${cached.url}:`, err);
  }
});

// --- Browser startup ---
browser.runtime.onStartup.addListener(async () => {
  isStartup = true;
  setTimeout(() => { isStartup = false; }, 3000);

  await initPinnedTabCache();

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

// --- Extension install / update ---
// Also init cache when extension is first loaded (not just on startup)
browser.runtime.onInstalled.addListener(() => {
  initPinnedTabCache();
});

// Init cache immediately for the case where the extension is loaded
// mid-session (e.g. temporary add-on during development)
initPinnedTabCache();
