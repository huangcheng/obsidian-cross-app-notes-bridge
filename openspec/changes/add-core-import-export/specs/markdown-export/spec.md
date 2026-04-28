## ADDED Requirements

### Requirement: Copy active note as portable Markdown
The plugin SHALL provide a command "Copy as pure Markdown" that converts the active note's contents into portable CommonMark and writes the result to the system clipboard.

#### Scenario: Copying a note with wikilinks and embeds
- **WHEN** the user invokes "Copy as pure Markdown" on a note containing `[[Other Note]]`, `![[image.png]]`, and a callout
- **THEN** the clipboard SHALL contain CommonMark where wikilinks become `[Other Note](Other%20Note.md)`, embedded images become standard `![](path)` links, and the callout is rendered as a blockquote
- **AND** the original note file SHALL NOT be modified

#### Scenario: Copying a note without an active editor
- **WHEN** the user invokes the command with no active Markdown view
- **THEN** the plugin SHALL show a notice "No active note to copy" and perform no clipboard write

### Requirement: Export selected notes to Markdown files
The plugin SHALL provide an "Export as pure Markdown" action available from the file menu (single note) and files menu (multi-select) that writes converted Markdown to a user-chosen folder outside or inside the vault.

#### Scenario: Bulk export with attachment rewriting enabled
- **WHEN** the user selects three notes in the file explorer and runs "Export as pure Markdown" with the "Copy attachments" option enabled
- **THEN** the plugin SHALL write three `.md` files to the chosen destination, copy referenced attachments alongside them, and rewrite attachment links in the exported files to relative paths

#### Scenario: Destination already contains a file with the same name
- **WHEN** an exported note's destination filename already exists
- **THEN** the plugin SHALL prompt with "Overwrite / Rename / Skip" before writing, and apply the chosen action per file or to all remaining conflicts when the user selects "Apply to all"

### Requirement: Configurable Markdown transforms
The plugin SHALL expose user-configurable toggles for each transform in the export pipeline, including: resolve wikilinks, strip or replace embeds, flatten callouts to blockquotes, drop YAML frontmatter, rewrite attachment links.

#### Scenario: User disables wikilink resolution
- **WHEN** the user disables "Resolve wikilinks" in settings and copies a note containing `[[Other Note]]`
- **THEN** the clipboard output SHALL preserve `[[Other Note]]` verbatim

#### Scenario: User enables "Drop frontmatter"
- **WHEN** "Drop frontmatter" is enabled and the note begins with a `---` YAML block
- **THEN** the exported Markdown SHALL omit the frontmatter block and start at the first content line

### Requirement: Transform summary before destructive export
For exports that write files (not clipboard copy), the plugin SHALL show a per-note summary of transforms that will be applied (e.g., counts of rewritten links, dropped embeds) and require explicit confirmation before writing.

#### Scenario: Reviewing transform impact
- **WHEN** the user triggers a multi-note export
- **THEN** a confirmation modal SHALL list each note with counts such as "3 wikilinks rewritten, 1 embed dropped, frontmatter removed"
- **AND** the export SHALL proceed only after the user clicks "Export"
