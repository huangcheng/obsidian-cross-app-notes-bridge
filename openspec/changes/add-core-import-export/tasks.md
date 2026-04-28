## 1. Project setup

- [x] 1.1 Rename plugin id to `advanced-import-export` in `manifest.json`, `package.json`, and update description, author, and `isDesktopOnly: true`
- [x] 1.2 Add runtime dependencies: `unified`, `remark-parse`, `remark-stringify`, `remark-frontmatter`, `@modelcontextprotocol/sdk`; update `esbuild.config.mjs` to bundle them and externalize Node built-ins
- [x] 1.3 Replace sample `main.ts` scaffolding with a `Plugin` skeleton that wires up command/menu registration points and a settings tab stub
- [x] 1.4 Establish `src/` module layout: `transforms/`, `providers/`, `bear/`, `orchestrator/`, `ui/`, `selection/`, `util/`

## 2. Markdown transform pipeline (capability: markdown-export)

- [x] 2.1 Implement `MarkdownTransformer` over `unified` with a config object exposing toggles for wikilink resolution, embed handling, callout flattening, frontmatter dropping, and attachment link rewriting
- [x] 2.2 Implement wikilink resolver that maps `[[Note]]` and `[[Note|alias]]` to `[alias](Note.md)` using `MetadataCache`
- [x] 2.3 Implement embed handler with modes: drop, replace-with-link, inline-image-link
- [x] 2.4 Implement callout flattener that converts `> [!note]` blocks to plain blockquotes with the title bolded
- [x] 2.5 Implement attachment link rewriter (vault-relative, absolute, or upload placeholder)
- [x] 2.6 Emit a per-note `TransformReport` (counts of rewritten links, dropped embeds, frontmatter status) for the UI summary

## 3. Markdown export commands and UI

- [x] 3.1 Register "Copy as pure Markdown" command targeting the active Markdown view; write result to clipboard via `navigator.clipboard`
- [x] 3.2 Register file-menu and files-menu items for "Export as pure Markdown" producing a `NoteSelection`
- [x] 3.3 Build the export confirmation modal showing per-note `TransformReport` and destination folder picker
- [x] 3.4 Implement file writer that copies/rewrites attachments and applies the user's collision policy (overwrite/rename/skip with "apply to all")
- [x] 3.5 Add settings panel section for transform toggles and default export destination

## 4. Selection model and orchestrator (capability: external-providers)

- [x] 4.1 Implement the `NoteSelection` struct and helpers to build it from each entry point (active editor, file menu, files menu, folder context menu, search modal)
- [x] 4.2 Implement the `ImportExportSession` event emitter with `started`, `noteSucceeded`, `noteFailed`, `cancelled`, `done` events
- [x] 4.3 Implement the orchestrator: takes `NoteSelection` + `Provider` + direction (`import`|`export`), runs N concurrent operations (configurable), supports cancellation, reports through the session
- [x] 4.4 Build the progress modal that subscribes to a session, renders per-note status with retry-failed and cancel buttons, and shows the final summary

## 5. Provider framework

- [x] 5.1 Define the `Provider` interface (`id`, `capabilities`, `listRemote`, `fetch`, `push`, optional `delete`) and `NormalizedNote` type (title, body, tags, attachments, sourceMeta)
- [x] 5.2 Implement the `ProviderRegistry` that loads provider configs from `data.json`, instantiates adapters, and exposes them to UI/orchestrator
- [ ] 5.3 Build the settings UI for provider management: list, add, edit, enable/disable, "test connection", and JSON import/export of configs (with sensitive fields stubbed)

## 6. CLI provider adapter

- [ ] 6.1 Implement `CliProvider` that spawns the configured binary via `child_process.spawn` (no shell), substitutes argv placeholders, and enforces an explicit user-trust flag
- [ ] 6.2 Define argv templates for `list`, `pull`, `push` with placeholders `${noteId}`, `${title}`, `${markdownPath}`, `${outputPath}` and a stdin mode for piping note bodies
- [ ] 6.3 Capture stdout/stderr, parse stdout (configurable: JSON list, Markdown body), and surface stderr (truncated to 4 KB) on failures
- [ ] 6.4 Add the bundled youdaonote-cli reference config and verify it via the "test connection" flow

## 7. MCP provider adapter

- [ ] 7.1 Wrap `@modelcontextprotocol/sdk` to support stdio (default) and Streamable HTTP transports per provider config
- [ ] 7.2 Implement tool discovery (`tools/list`) and a per-provider mapping of tool names to `list`/`fetch`/`push` operations
- [ ] 7.3 Translate MCP tool responses into `NormalizedNote` objects (handle text, structured content, and attachment references)
- [ ] 7.4 Add the bundled wps-note reference config (stdio command + tool-name mapping) and verify it via "test connection"

## 8. HTTP provider adapter

- [ ] 8.1 Implement `HttpProvider` using `requestUrl` with configurable method, path, headers, body templates and placeholder substitution
- [ ] 8.2 Implement auth modes: none, bearer token, basic, custom header (with masked storage)
- [ ] 8.3 Map response shapes to `NormalizedNote` via a small JSONPath/dot-path config (configurable per operation)
- [ ] 8.4 Surface non-2xx responses with status code and truncated body in the progress modal

## 9. Bear bridge (capability: bear-bridge)

- [ ] 9.1 Implement `BearProvider` invoking `bear://x-callback-url/create`, `/open-note`, `/search`, `/tags` via `window.open`/`shell.openExternal`
- [ ] 9.2 Implement the localhost callback listener (`http.createServer` on an ephemeral port) that registers per-request handlers for `x-success`/`x-error` with timeouts (default 15s)
- [ ] 9.3 Implement Bear export flow: per-note create with tags from frontmatter, progress reported through the session, cancellable mid-batch
- [ ] 9.4 Implement Bear import flow: selection by ID, by tag, or via search modal; convert returned content to `.md` files with frontmatter `tags`
- [ ] 9.5 Detect platform/Bear availability and degrade gracefully (Windows/Linux: disable imports, document fire-and-forget export limitation)

## 10. Cross-cutting polish and release readiness

- [ ] 10.1 Add Notice-based error reporting helpers and a developer log gated by a settings toggle (avoid leaking secrets)
- [ ] 10.2 Write README sections covering each capability, security model for CLI/MCP, and reference provider setup
- [ ] 10.3 Add minimal unit tests for transformers and argv-substitution (Node test runner) and wire `npm test`
- [ ] 10.4 Run `openspec validate add-core-import-export --strict` and resolve any findings
- [ ] 10.5 Manual smoke test: copy-as-pure-markdown, export to folder, Bear export (macOS), wps-note MCP fetch, youdaonote-cli pull, generic HTTP push
