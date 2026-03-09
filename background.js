"use strict";

let isStartup = false;

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

// --- Browser startup ---
browser.runtime.onStartup.addListener(async () => {
  isStartup = true;
  setTimeout(() => { isStartup = false; }, 3000);

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
