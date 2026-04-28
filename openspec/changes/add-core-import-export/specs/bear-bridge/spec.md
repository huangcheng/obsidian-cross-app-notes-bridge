## ADDED Requirements

### Requirement: Export Obsidian notes to Bear via x-callback-url
The plugin SHALL provide an "Export to Bear" action (command, file menu, files menu) that creates new Bear notes using Bear's `bear://x-callback-url/create` endpoint, supporting single-note and multi-note selections.

#### Scenario: Exporting a single note with tags
- **WHEN** the user runs "Export to Bear" on a note whose frontmatter contains `tags: [project, idea]`
- **THEN** the plugin SHALL invoke `bear://x-callback-url/create` with the note title, body, and `tags=project,idea`
- **AND** the exported Bear note SHALL appear with the specified tags

#### Scenario: Exporting multiple notes
- **WHEN** the user multi-selects five notes and runs "Export to Bear"
- **THEN** the plugin SHALL create five Bear notes, one per source note, reporting per-note success or failure in a progress modal
- **AND** the operation SHALL be cancellable mid-batch, with already-created notes left intact

### Requirement: Import Bear notes into the vault
The plugin SHALL provide an "Import from Bear" command that lets the user select one or more Bear notes (by ID, by tag, or via a search modal) and creates corresponding `.md` files in a user-chosen vault folder.

#### Scenario: Importing notes by tag
- **WHEN** the user runs "Import from Bear", chooses "By tag", and enters `#research`
- **THEN** the plugin SHALL request matching notes from Bear (`/search` then per-note `/open-note` with `show_window=no`), receive the contents via x-callback, and create one `.md` file per note in the chosen folder
- **AND** Bear tags SHALL be written into YAML frontmatter as `tags: [...]`

#### Scenario: Importing a note whose title collides with an existing vault file
- **WHEN** the imported note's filename collides with an existing file
- **THEN** the plugin SHALL apply the user's configured collision policy (suffix, overwrite-with-confirm, or skip)

### Requirement: Bear callback handling
For operations that require a response from Bear, the plugin SHALL register an `x-success` callback URL that points to a localhost listener it controls, capture the returned payload, and resolve the in-flight operation; on `x-error` it SHALL surface Bear's error code and message to the user.

#### Scenario: Bear returns an error code
- **WHEN** Bear invokes the `x-error` callback with `errorCode=2` and `errorMessage=Note not found`
- **THEN** the plugin SHALL display "Bear error 2: Note not found" in the progress modal and mark that note as failed without aborting other in-flight operations

#### Scenario: Operation times out
- **WHEN** Bear does not invoke the success or error callback within the configured timeout (default 15s)
- **THEN** the plugin SHALL mark the operation as timed out, close the listener for that request, and let the user retry

### Requirement: Platform availability and graceful degradation
The Bear bridge SHALL be available on macOS where Bear and the localhost callback listener can run; on platforms without callback support the plugin SHALL still allow fire-and-forget exports (create only) but SHALL disable imports and surface an explanatory notice.

#### Scenario: Running on Windows
- **WHEN** the user opens settings on Windows
- **THEN** the Bear provider SHALL show "Import requires macOS; export is unavailable on this platform" and disable both actions

#### Scenario: Running on macOS without Bear installed
- **WHEN** the user runs "Export to Bear" and `bear://` is not registered as a URL handler
- **THEN** the plugin SHALL detect the failure and show "Bear does not appear to be installed" within the configured timeout window
