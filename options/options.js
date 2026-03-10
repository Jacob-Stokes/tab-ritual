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

  // Build row cells via DOM API (avoids innerHTML with dynamic values)
  const tdDrag = document.createElement("td");
  tdDrag.className = "center";
  const dragSpan = document.createElement("span");
  dragSpan.className = "drag-handle";
  dragSpan.title = "Drag to reorder";
  dragSpan.textContent = "\u2630";
  tdDrag.appendChild(dragSpan);

  const tdUrl = document.createElement("td");
  const urlInput = document.createElement("input");
  urlInput.type = "url";
  urlInput.className = "url-input";
  urlInput.placeholder = "https://example.com";
  urlInput.value = tabData ? tabData.url : "";
  tdUrl.appendChild(urlInput);

  const tdStartup = document.createElement("td");
  tdStartup.className = "center";
  const startupCheck = document.createElement("input");
  startupCheck.type = "checkbox";
  startupCheck.className = "startup-check";
  startupCheck.checked = tabData ? tabData.onStartup : false;
  tdStartup.appendChild(startupCheck);

  const tdNewWindow = document.createElement("td");
  tdNewWindow.className = "center";
  const newWindowCheck = document.createElement("input");
  newWindowCheck.type = "checkbox";
  newWindowCheck.className = "newwindow-check";
  newWindowCheck.checked = tabData ? tabData.onNewWindow : false;
  tdNewWindow.appendChild(newWindowCheck);

  const tdPinned = document.createElement("td");
  tdPinned.className = "center";
  const pinnedCheck = document.createElement("input");
  pinnedCheck.type = "checkbox";
  pinnedCheck.className = "pinned-check";
  pinnedCheck.checked = tabData ? tabData.pinned : false;
  tdPinned.appendChild(pinnedCheck);

  const tdDelete = document.createElement("td");
  tdDelete.className = "center";
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.type = "button";
  deleteBtn.title = "Remove";
  deleteBtn.textContent = "\u2715";
  tdDelete.appendChild(deleteBtn);

  tr.append(tdDrag, tdUrl, tdStartup, tdNewWindow, tdPinned, tdDelete);

  deleteBtn.addEventListener("click", () => {
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
    urlInput.focus();
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

