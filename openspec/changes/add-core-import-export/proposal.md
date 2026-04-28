## Why

Obsidian users frequently need to move notes between Obsidian and other tools (Bear, Youdao Note, WPS, custom CLIs, MCP servers, HTTP services), but today this requires manual copy-paste, third-party scripts, or losing formatting/attachments along the way. A first-class import/export plugin removes this friction and makes Obsidian a comfortable hub in a multi-tool note-taking workflow.

## What Changes

- Add a "Copy as pure Markdown" command/context-menu action that strips Obsidian-specific syntax (wikilinks, embeds, callouts, frontmatter blocks the user opts to remove) into portable CommonMark for pasting elsewhere.
- Add Bear import/export via Bear's `bear://` x-callback-url scheme, supporting single notes and multi-select (active editor, file menu, multi-file menu) with attachment and tag handling.
- Add a pluggable "External Provider" framework that lets the plugin import from / export to:
  - CLI-based providers (e.g., `youdaonote-cli`-style binaries invoked via child process).
  - MCP servers (e.g., `wps-note` MCP) over stdio/HTTP transports.
  - Generic HTTP services with user-supplied endpoint, auth, and request templates.
- Ship one reference provider per transport (CLI: youdaonote-cli; MCP: wps-note; HTTP: generic JSON) so users have working examples and the contracts are exercised.
- Add a settings UI for managing providers (enable/disable, credentials, paths, mappings) and an import/export modal showing per-note progress and conflicts.

## Capabilities

### New Capabilities
- `markdown-export`: Convert Obsidian notes to portable Markdown (clipboard copy + file export) with configurable transforms for wikilinks, embeds, callouts, and frontmatter.
- `bear-bridge`: Import notes from Bear and export Obsidian notes to Bear via the `bear://` x-callback-url API, supporting single and bulk operations.
- `external-providers`: Pluggable provider framework with adapters for CLI tools, MCP servers, and HTTP services, plus the user-facing import/export workflow (selection, progress, conflict resolution) that drives them.

### Modified Capabilities
<!-- None — this is the initial change for a new plugin. -->

## Impact

- New source modules under `src/` for: markdown transform pipeline, Bear URL-scheme client, provider registry, CLI/MCP/HTTP provider adapters, import/export orchestrator, and settings/modal UI.
- New runtime dependencies likely needed: an MCP client SDK (e.g., `@modelcontextprotocol/sdk`), and a small Markdown AST library (e.g., `remark`/`unified`) for the export transforms. Bear bridge and HTTP provider can use platform APIs only.
- `manifest.json` and `package.json` will be updated with the real plugin id (`advanced-import-export`), description, and dependencies; `isDesktopOnly` will likely become `true` because CLI/MCP transports require Node child_process.
- New commands, ribbon entries, file-menu items, and a settings tab; no changes to existing user data formats.
- Security/privacy surface: provider credentials and arbitrary command execution must be stored and prompted for carefully (covered in design.md).
