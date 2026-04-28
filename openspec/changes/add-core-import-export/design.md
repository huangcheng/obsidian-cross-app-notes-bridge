## Context

This is the foundational change for a new Obsidian plugin (`advanced-import-export`). The plugin starts from the Obsidian sample-plugin scaffold and must add three feature areas with overlap (selection UX, attachment handling, error reporting). Several transports (CLI subprocess, MCP stdio/HTTP, Bear `bear://` URLs, generic HTTP) need a common abstraction so we don't grow N×M code paths. Targets are Obsidian desktop (Electron) primarily; mobile is best-effort and disabled for transports that need Node APIs.

## Goals / Non-Goals

**Goals:**
- A single import/export pipeline that operates on a "note selection" (active note, file-menu single, files-menu multi, folder) and routes to a chosen target.
- A provider abstraction with adapters for Bear (URL scheme), CLI tools, MCP servers, and HTTP endpoints, all conforming to the same `Provider` interface.
- A pure-Markdown transform pipeline that is reused by clipboard copy and by file/HTTP/Bear export paths.
- Configuration UI that is safe by default: explicit opt-in for executing CLIs and connecting to MCP servers, credential storage off the vault.
- Reference adapters that ship with the plugin: youdaonote-cli (CLI), wps-note (MCP), generic HTTP/JSON.

**Non-Goals:**
- Real-time bidirectional sync. Imports/exports are user-triggered, one-shot operations.
- Conflict-free merging across systems. We surface conflicts and let the user choose; we don't auto-merge note bodies.
- Replicating every Obsidian-specific feature in target tools. We document what is lossy.
- Mobile parity for CLI/MCP transports (Electron-only); Bear bridge and HTTP provider can work on macOS/iOS where the URL scheme/network is available.

## Decisions

### D1. Provider interface as the single seam

A `Provider` interface with `id`, `capabilities` (`canImport`, `canExport`, `supportsBulk`, `supportsAttachments`), and methods `listRemote()`, `fetch(remoteId)`, `push(note)`, `delete?(remoteId)`. Transport-specific adapters (`BearProvider`, `CliProvider`, `McpProvider`, `HttpProvider`) implement it.

Alternatives considered: per-feature ad-hoc code (rejected — duplicates selection/progress/conflict logic); a generic plugin-of-plugin loader (rejected for v1 — too much surface; revisit once 3+ third-party providers exist).

### D2. Markdown transform via `unified` + `remark`

Use `remark-parse` → custom transformers → `remark-stringify`. Transformers are toggleable (resolve wikilinks to `[text](path.md)`, strip embeds or replace with reference, flatten callouts to blockquotes, optionally drop frontmatter, rewrite attachment links to absolute paths or upload tokens).

Alternatives: regex-only transforms (rejected — fragile against code blocks, tables); writing a hand-rolled parser (rejected — reinvents `remark`).

### D3. CLI provider runs through Node `child_process` with explicit allowlist

Each configured CLI provider stores: binary path, argv templates per operation (`list`, `pull`, `push`), working dir, env. The plugin never executes a binary that isn't in the user-configured list; argv templates use `${noteId}`, `${filePath}` placeholders that are shell-quoted by the plugin (no shell). Set `isDesktopOnly: true`.

Alternatives: spawn a shell with a single command string (rejected — injection-prone); a fixed list of supported CLIs hardcoded (rejected — defeats the "pluggable" goal).

### D4. MCP provider uses the official `@modelcontextprotocol/sdk` over stdio (default) and Streamable HTTP

We declare a small mapping: which MCP tool names correspond to `list`/`fetch`/`push` for a given server config. For wps-note, the reference mapping is shipped. Stdio transport requires desktop; HTTP transport works anywhere with network.

Alternatives: build our own JSON-RPC client (rejected — MCP semantics evolve, SDK keeps up); skip MCP for v1 (rejected — explicitly in scope per proposal).

### D5. Bear bridge uses `x-success`/`x-error` callback flow with a temporary local HTTP listener on desktop

Bear's `bear://x-callback-url/` returns results to a callback URL. On desktop, the plugin spins up a localhost HTTP listener on an ephemeral port for the duration of the operation and uses `http://127.0.0.1:<port>/bear-callback` as `x-success`. On platforms where this isn't available, we fall back to fire-and-forget export and document the limitation.

Alternatives: register a custom URL scheme handler in Obsidian (rejected — Obsidian doesn't expose a stable API for that); polling Bear's database file (rejected — undocumented, fragile).

### D6. Selection model is a `NoteSelection` struct

`{ source: 'active' | 'file-menu' | 'files-menu' | 'folder' | 'modal-search', notes: TFile[] }`. All commands and menus produce this struct, then call the orchestrator. Bulk operations stream progress via an `ImportExportSession` event emitter that the modal renders.

### D7. Credentials live in plugin data (`data.json`), not the vault

`this.saveData()` stores provider configs. Sensitive fields are tagged so the settings UI can mask them. We do not write credentials into note frontmatter or vault files. We document that `data.json` is unencrypted and recommend OS keychain integration as a follow-up.

## Risks / Trade-offs

- **Arbitrary code execution via CLI provider** → Allowlist-only, argv templates with placeholder substitution (no shell), confirmation modal on first run of a new provider.
- **Bear callback fragility on Windows/Linux** → Detect platform; show a "Bear export is macOS/iOS-only" notice and disable bulk imports there.
- **MCP server compatibility drift** → Pin SDK version, surface tool-discovery errors clearly, ship a "test connection" button per provider.
- **Markdown transform lossiness (callouts, dataview, embeds)** → Each transform is toggleable; export modal shows a per-note diff summary ("3 wikilinks rewritten, 1 embed dropped") before committing.
- **Large bulk operations blocking the UI** → Run providers in async batches with a configurable concurrency (default 4), cancellable from the progress modal.
- **Storing tokens in `data.json`** → Document the limitation; provide an "external credential file" path option for users who want to keep secrets out of plugin data.

## Migration Plan

This is a new plugin; there is no prior version to migrate from. First release will be tagged `0.1.0`, marked `isDesktopOnly: true` initially, and published with the three reference providers disabled by default. Users opt-in per provider in settings. Rollback: users disable the plugin; no vault data is mutated unless an import is run, and imports always create new notes (never overwrite without confirmation).

## Open Questions

- Which Markdown AST library version to pin (`remark` v15 vs. `unified` v11 ecosystem)? Decide during task 2.1.
- Should the HTTP provider support OAuth flows in v1, or only static tokens? Leaning static-only for v1.
- For Bear export of multi-note selections, do we use `/create` per note (slower, more reliable) or `/import` with a single OPML/Markdown blob (faster, lossy on tags)? Default to per-note with concurrency.
