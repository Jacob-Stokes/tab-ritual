# Tab Ritual

A Firefox extension that automatically opens configured tabs on browser startup and/or new window creation, with optional tab pinning.

## Features

- Configure a list of URLs to open automatically
- Per-URL control over:
  - **On Startup** - open when Firefox starts
  - **On New Window** - open when a new window is created
  - **Pinned** - open as a pinned tab
- Simple table-based preferences UI
- Settings sync across Firefox profiles via `storage.sync`

## Install for Development

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on..."**
3. Select the `manifest.json` file from this directory
4. The extension is now active until Firefox restarts

## Configure

1. Go to `about:addons` (or menu > Add-ons and Themes)
2. Find **Tab Ritual** and click **Preferences**
3. Add URLs and check the boxes for your desired behavior
4. Click **Save**

## Development with web-ext

For live-reloading during development:

```bash
npm install -g web-ext
web-ext run
```

This launches a fresh Firefox profile with the extension loaded and auto-reloads on file changes.
