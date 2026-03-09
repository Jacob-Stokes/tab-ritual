"use strict";

document.addEventListener("DOMContentLoaded", loadOptions);
document.getElementById("add-btn").addEventListener("click", () => addRow());
document.getElementById("save-btn").addEventListener("click", saveOptions);

async function loadOptions() {
  const { tabs } = await browser.storage.sync.get({ tabs: [] });
  const tbody = document.getElementById("tab-rows");
  tbody.innerHTML = "";

  if (tabs.length === 0) {
    addRow();
  } else {
    for (const tab of tabs) {
      addRow(tab);
    }
  }
}

function addRow(tabData = null) {
  const tbody = document.getElementById("tab-rows");
  const tr = document.createElement("tr");

  const urlValue = tabData ? tabData.url : "";
  const startupChecked = tabData && tabData.onStartup ? "checked" : "";
  const newWindowChecked = tabData && tabData.onNewWindow ? "checked" : "";
  const pinnedChecked = tabData && tabData.pinned ? "checked" : "";

  tr.innerHTML = `
    <td><input type="url" class="url-input" placeholder="https://example.com" value="${escapeHtml(urlValue)}"></td>
    <td class="center"><input type="checkbox" class="startup-check" ${startupChecked}></td>
    <td class="center"><input type="checkbox" class="newwindow-check" ${newWindowChecked}></td>
    <td class="center"><input type="checkbox" class="pinned-check" ${pinnedChecked}></td>
    <td class="center"><button class="delete-btn" type="button" title="Remove">&#x2715;</button></td>
  `;

  tr.querySelector(".delete-btn").addEventListener("click", () => {
    tr.remove();
  });

  tbody.appendChild(tr);

  // Focus the new URL input if it's empty
  if (!tabData) {
    tr.querySelector(".url-input").focus();
  }
}

async function saveOptions() {
  const rows = document.querySelectorAll("#tab-rows tr");
  const tabs = [];
  let hasError = false;

  for (const row of rows) {
    const urlInput = row.querySelector(".url-input");
    const url = urlInput.value.trim();

    // Skip completely empty rows
    if (!url) continue;

    // Validate URL
    if (!isValidUrl(url)) {
      urlInput.classList.add("error");
      hasError = true;
      continue;
    }

    urlInput.classList.remove("error");

    tabs.push({
      url: url,
      onStartup: row.querySelector(".startup-check").checked,
      onNewWindow: row.querySelector(".newwindow-check").checked,
      pinned: row.querySelector(".pinned-check").checked,
    });
  }

  if (hasError) {
    showStatus("Please fix invalid URLs (must start with http:// or https://)", true);
    return;
  }

  await browser.storage.sync.set({ tabs });
  showStatus("Settings saved!");
}

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function showStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = isError ? "status-error" : "status-success";
  if (!isError) {
    setTimeout(() => {
      status.textContent = "";
      status.className = "";
    }, 2000);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
