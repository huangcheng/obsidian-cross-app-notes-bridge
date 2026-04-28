## ADDED Requirements

### Requirement: Provider interface
The plugin SHALL define a `Provider` interface that every external integration implements, exposing an `id`, declared `capabilities` (`canImport`, `canExport`, `supportsBulk`, `supportsAttachments`), and methods `listRemote`, `fetch`, and `push` (plus an optional `delete`). The orchestrator SHALL only call methods that match a provider's declared capabilities.

#### Scenario: Provider declares export-only capability
- **WHEN** a provider sets `capabilities.canImport = false`
- **THEN** the import UI SHALL NOT list that provider as a source
- **AND** the orchestrator SHALL refuse to call `fetch` on it

### Requirement: CLI provider adapter
The plugin SHALL ship a CLI provider adapter that invokes user-configured binaries (e.g., `youdaonote-cli`) via Node `child_process.spawn` with argv templates, never via a shell, and SHALL refuse to run a binary unless the user has explicitly added and confirmed it in settings.

#### Scenario: Configuring a new CLI provider
- **WHEN** the user adds a new CLI provider with binary path `/usr/local/bin/youdaonote-cli` and argv template `pull --id ${noteId} --out ${outputPath}`
- **THEN** the plugin SHALL show a confirmation modal listing the binary path and templates and SHALL persist the provider as disabled until the user clicks "Trust and enable"

#### Scenario: Argv placeholder substitution
- **WHEN** the orchestrator calls `fetch` with `noteId="abc 123"`
- **THEN** the CLI adapter SHALL pass `abc 123` as a single argv element (not split on spaces) and SHALL NOT spawn a shell

#### Scenario: Binary exits non-zero
- **WHEN** the configured binary exits with a non-zero status
- **THEN** the adapter SHALL surface stderr (truncated to 4 KB) and the exit code in the import/export progress modal and mark that note as failed

### Requirement: MCP provider adapter
The plugin SHALL ship an MCP provider adapter that connects to user-configured MCP servers (stdio or Streamable HTTP transport) using the official `@modelcontextprotocol/sdk`, discovers available tools, and maps user-chosen tool names to `list`, `fetch`, and `push` operations.

#### Scenario: Configuring the wps-note reference MCP server
- **WHEN** the user enables the bundled wps-note MCP provider
- **THEN** the adapter SHALL launch the configured stdio command, perform `tools/list`, verify the expected tool names exist, and mark the provider "Ready"
- **AND** failure at any step SHALL leave the provider disabled with the underlying error visible in settings

#### Scenario: MCP tool returns a structured note
- **WHEN** `fetch` calls the mapped MCP tool and the response includes Markdown content and metadata
- **THEN** the adapter SHALL return a normalized note object containing title, body, tags, and any attachment references for the orchestrator to write into the vault

### Requirement: HTTP provider adapter
The plugin SHALL ship a generic HTTP provider adapter where the user configures base URL, authentication (none, bearer token, basic, custom header), and request templates (method, path, headers, body) for `list`, `fetch`, and `push` operations using JSON or Markdown payloads.

#### Scenario: Bearer-authenticated push
- **WHEN** the user has configured an HTTP provider with bearer auth and a `push` template `POST /notes` with body `{ "title": "${title}", "body": "${markdown}" }`
- **THEN** the adapter SHALL send the request with the `Authorization: Bearer <token>` header and a body containing the substituted values

#### Scenario: Server returns a non-2xx response
- **WHEN** the HTTP server returns 401 or 5xx
- **THEN** the adapter SHALL mark the per-note operation as failed and include the status code and response body (truncated) in the progress modal

### Requirement: Import/export orchestration UX
The plugin SHALL provide a unified import/export workflow driven by a `NoteSelection` (active note, file menu, multi-select files menu, folder, or search modal) and a chosen provider, with a progress modal that streams per-note status, supports cancellation, and reports a final summary.

#### Scenario: Bulk export with concurrency
- **WHEN** the user exports 20 notes via a provider
- **THEN** the orchestrator SHALL run at most N concurrent operations (configurable, default 4) and update the progress modal as each note succeeds or fails
- **AND** clicking "Cancel" SHALL stop dispatching new operations and report the partial result

#### Scenario: Conflict on import
- **WHEN** an imported note's target filename already exists in the vault
- **THEN** the orchestrator SHALL apply the user's configured policy (prompt, suffix, overwrite-with-confirm, or skip)

### Requirement: Provider configuration storage
The plugin SHALL persist provider configurations and credentials in plugin data (`data.json`), not in vault notes; sensitive fields SHALL be marked so the settings UI masks them; provider configs SHALL be exportable and importable as JSON for portability.

#### Scenario: Sensitive field masking
- **WHEN** the user opens the settings tab for an HTTP provider with a stored bearer token
- **THEN** the token field SHALL render masked with a "Reveal" affordance and SHALL NOT be logged to the developer console

#### Scenario: Exporting provider configs
- **WHEN** the user clicks "Export provider configs"
- **THEN** the plugin SHALL produce a JSON file containing all provider settings with sensitive fields replaced by placeholders the user must re-enter on import
