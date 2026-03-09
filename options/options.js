"use strict";

let dragSrcRow = null;

document.addEventListener("DOMContentLoaded", loadOptions);
document.getElementById("add-btn").addEventListener("click", () => addRow());
document.getElementById("save-btn").addEventListener("click", saveOptions);

async function loadOptions() {
  const { tabs } = await browser.storage.sync.get({
    tabs: [],
  });

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
  tr.draggable = true;

  const urlValue = tabData ? tabData.url : "";
  const startupChecked = tabData && tabData.onStartup ? "checked" : "";
  const newWindowChecked = tabData && tabData.onNewWindow ? "checked" : "";
  const pinnedChecked = tabData && tabData.pinned ? "checked" : "";
  tr.innerHTML = `
    <td class="center"><span class="drag-handle" title="Drag to reorder">&#x2630;</span></td>
    <td><input type="url" class="url-input" placeholder="https://example.com" value="${escapeHtml(urlValue)}"></td>
    <td class="center"><input type="checkbox" class="startup-check" ${startupChecked}></td>
    <td class="center"><input type="checkbox" class="newwindow-check" ${newWindowChecked}></td>
    <td class="center"><input type="checkbox" class="pinned-check" ${pinnedChecked}></td>
    <td class="center"><button class="delete-btn" type="button" title="Remove">&#x2715;</button></td>
  `;

  tr.querySelector(".delete-btn").addEventListener("click", () => {
    tr.remove();
  });

  // Drag-and-drop events
  tr.addEventListener("dragstart", handleDragStart);
  tr.addEventListener("dragover", handleDragOver);
  tr.addEventListener("dragenter", handleDragEnter);
  tr.addEventListener("dragleave", handleDragLeave);
  tr.addEventListener("drop", handleDrop);
  tr.addEventListener("dragend", handleDragEnd);

  tbody.appendChild(tr);

  if (!tabData) {
    tr.querySelector(".url-input").focus();
  }
}

// --- Drag and drop ---

function handleDragStart(e) {
  dragSrcRow = this;
  this.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", ""); // required for Firefox
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

function handleDragEnter(e) {
  e.preventDefault();
  const row = e.currentTarget;
  if (row !== dragSrcRow) {
    row.classList.add("drag-over");
  }
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

function handleDrop(e) {
  e.preventDefault();
  const targetRow = e.currentTarget;
  targetRow.classList.remove("drag-over");

  if (dragSrcRow && dragSrcRow !== targetRow) {
    const tbody = document.getElementById("tab-rows");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const srcIndex = rows.indexOf(dragSrcRow);
    const targetIndex = rows.indexOf(targetRow);

    if (srcIndex < targetIndex) {
      tbody.insertBefore(dragSrcRow, targetRow.nextSibling);
    } else {
      tbody.insertBefore(dragSrcRow, targetRow);
    }
  }
}

function handleDragEnd() {
  dragSrcRow = null;
  for (const row of document.querySelectorAll("#tab-rows tr")) {
    row.classList.remove("dragging", "drag-over");
  }
}

// --- Save / Load ---

async function saveOptions() {
  const rows = document.querySelectorAll("#tab-rows tr");
  const tabs = [];
  let hasError = false;

  for (const row of rows) {
    const urlInput = row.querySelector(".url-input");
    const url = urlInput.value.trim();

    if (!url) continue;

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
