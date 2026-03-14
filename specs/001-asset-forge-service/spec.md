# Feature Specification: Asset Forge Service

**Feature Branch**: `001-asset-forge-service`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Web service for generating classic Macintosh game assets using an LLM. Users create projects, generate sprites via prompts with grid sizes, preview in scaled browser viewport, iterate on existing sprites, and export as PICT 2.0 MacBinary files."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a Project (Priority: P1)

A user opens the Asset Forge in their browser and creates a new project. They give it a name (e.g., "Tank Game") and a description of the game and visual themes (e.g., "a top-down tank battle game with desert and jungle maps"). The LLM generates an initial 16-color palette from the description. The project is now their workspace for generating and collecting assets. They can see it listed and select it to start working.

**Why this priority**: Without a project, there is nowhere to store or organize assets. This is the foundation everything else builds on.

**Independent Test**: Can be fully tested by opening the app, creating a project, seeing it listed, and selecting it. Delivers a named workspace ready for asset generation.

**Acceptance Scenarios**:

1. **Given** the app is running, **When** the user creates a project with name "Tank Game" and description "a top-down tank battle game with desert and jungle maps", **Then** the project appears in the project list with an LLM-generated palette and can be selected
2. **Given** a project exists, **When** the user selects it, **Then** they see an empty asset library ready for sprite generation
3. **Given** no projects exist, **When** the user opens the app, **Then** they are prompted to create their first project

---

### User Story 2 - Generate a Sprite from a Prompt (Priority: P1)

A user has a project selected. They type a prompt like "draw a top-down yellow tank with a big gun" and choose a grid size (e.g., 64x64). They click generate. The service sends the prompt, palette, and dimensions to the LLM via OpenRouter. The LLM returns a 2D array of palette indices. The browser renders the result as a scaled-up pixel grid where each cell represents one real pixel. The user can see the sprite at different zoom levels and toggle a grid overlay. If they like it, they save it to the project.

**Why this priority**: This is the core value proposition — going from a text description to a visible pixel-art sprite. Without this, the service has no purpose.

**Independent Test**: Can be fully tested by selecting a project, entering a prompt, choosing a grid size, generating a sprite, seeing the preview, and saving it. Delivers a visible, saveable game asset from a text prompt.

**Acceptance Scenarios**:

1. **Given** a project is selected, **When** the user enters a prompt and grid size and clicks generate, **Then** a sprite preview appears in the scaled grid viewport
2. **Given** a sprite preview is shown, **When** the user adjusts the zoom scale, **Then** the grid cells resize and the sprite remains sharp (no interpolation — each cell is a solid color block)
3. **Given** a sprite preview is shown, **When** the user toggles the grid overlay, **Then** grid lines appear every 8 pixels for alignment reference
4. **Given** a sprite preview is shown, **When** the user clicks save, **Then** the sprite is added to the project's asset library with its prompt and dimensions recorded
5. **Given** the LLM returns data, **When** the response is not a valid pixel grid, **Then** the user sees a clear error message and can retry

---

### User Story 3 - Browse and Manage the Asset Library (Priority: P2)

A user has generated several sprites in their project. They can browse all saved assets, see each sprite rendered in the grid viewport, and view the prompt that created it. They can delete sprites they don't want.

**Why this priority**: Users need to see what they've created and manage their collection. Without this, the project is just a black box.

**Independent Test**: Can be fully tested by generating a few sprites, browsing the library, viewing individual sprites, and deleting one. Delivers visibility and control over the asset collection.

**Acceptance Scenarios**:

1. **Given** a project has saved sprites, **When** the user opens the asset library, **Then** they see all sprites rendered as grid thumbnails with names
2. **Given** the asset library is showing, **When** the user selects a sprite, **Then** they see the full-size grid preview and the prompt that generated it
3. **Given** a sprite is selected, **When** the user deletes it, **Then** it is removed from the library

---

### User Story 4 - Iterate on an Existing Sprite (Priority: P2)

A user has a yellow tank sprite they like. They select it and choose "Create variation." The existing sprite's grid data is shown alongside a new prompt field. The user types "make the tank blue" and clicks generate. The LLM receives both the existing sprite data and the new prompt, and returns a new sprite. The original yellow tank remains unchanged in the library. The new blue tank is a separate sprite that can be saved alongside it.

**Why this priority**: Iteration is how users build up coherent asset sets — recoloring, creating animation frames, making variants. Without it, every sprite is generated from scratch with no consistency.

**Independent Test**: Can be fully tested by generating a sprite, selecting it, entering a variation prompt, generating the new version, and confirming both sprites exist independently in the library.

**Acceptance Scenarios**:

1. **Given** a saved sprite is selected, **When** the user chooses "Create variation" and enters a new prompt, **Then** the LLM receives both the existing sprite data and the new prompt
2. **Given** a variation is generated, **When** it appears in preview, **Then** the original sprite is unchanged in the library
3. **Given** a variation is generated, **When** the user saves it, **Then** both the original and the variation exist as separate sprites in the library
4. **Given** a variation is being created, **When** the user views the preview, **Then** they can see the original sprite alongside the new variation for comparison

---

### User Story 5 - Export Sprites as PICT Files (Priority: P3)

A user has built up a collection of sprites and wants to transfer them to a classic Mac. For a single sprite, they click export and download a MacBinary .bin file containing the PICT. For all sprites in a project, they click "Export All" and download an HFS disk image (.dsk) containing every sprite as a PICT file. When the .dsk is transferred to a classic Mac (or mounted in an emulator), it appears as a disk volume with all the PICT files inside. Individual .bin files can also be transferred and opened directly.

**Why this priority**: Export is the final step in the pipeline and essential for the project's purpose, but generating and iterating on sprites delivers value even before export is implemented.

**Independent Test**: Can be fully tested by exporting a single sprite as .bin and a full project as .dsk, transferring both to a classic Mac (or emulator), and verifying the files open correctly. Delivers real Mac-compatible game assets.

**Acceptance Scenarios**:

1. **Given** a sprite is selected, **When** the user clicks export, **Then** the sprite is converted to a PICT 2.0 MacBinary .bin file and downloaded
2. **Given** a project with saved sprites, **When** the user clicks "Export All", **Then** all sprites are converted to PICT 2.0 files and packaged into an HFS disk image (.dsk) for download. The disk image contains a folder named after the project (e.g., "Tank Game"), with each sprite as a native PICT file (type `PICT`, creator `ttxt`) inside it
3. **Given** an exported .bin file, **When** transferred to a classic Mac running System 7+, **Then** the file opens as a standard PICT image showing the sprite with correct colors
4. **Given** an exported .dsk file, **When** mounted on a classic Mac running System 7+, **Then** it appears as a disk volume containing a project folder with all sprites as native PICT files that open directly
5. **Given** a sprite with transparent pixels (palette index 0), **When** exported as PICT, **Then** the transparent areas are rendered with the designated transparent color
6. **Given** a project with a 16-color palette, **When** sprites are exported, **Then** the PICT files use 4-bit indexed color with the project's palette embedded
7. **Given** a project with up to 256 colors, **When** sprites are exported, **Then** the PICT files use 8-bit indexed color

---

### Edge Cases

- What happens when the LLM returns a grid with wrong dimensions? The service shows an error and the user can retry with the same prompt.
- What happens when the LLM returns palette indices outside the palette range? Out-of-range indices are clamped to 0 (transparent).
- What happens when the OpenRouter API is unavailable? The user sees a clear connection error and can retry.
- What happens when a project has no sprites and the user tries to export? The export option is disabled or hidden.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to create named projects with a text description (e.g., "a top-down tank battle game with desert and jungle themes"). The LLM generates an initial 16-color palette from the description. Each project has its own palette and asset library
- **FR-002**: System MUST allow users to enter a text prompt and select a grid size (width x height in pixels) to generate a sprite
- **FR-003**: System MUST send the prompt, project palette, and target dimensions to an LLM via OpenRouter and receive a 2D array of palette indices. Only Anthropic models are supported (Opus, Sonnet, Haiku — latest versions). The model is configurable via `OPENROUTER_MODEL` environment variable, defaulting to the latest Anthropic Sonnet.
- **FR-004**: System MUST render the generated sprite in a scaled grid viewport where each palette index maps to a colored cell, with adjustable zoom (2-8px per cell)
- **FR-005**: System MUST provide a grid overlay toggle showing lines every 8 pixels
- **FR-006**: System MUST allow users to save generated sprites to the project's asset library with the generating prompt recorded
- **FR-007**: System MUST allow users to select an existing sprite as a starting point and provide a new prompt to generate a variation, producing a new sprite without modifying the original
- **FR-008**: System MUST allow users to browse all saved sprites in a project, view them in the grid viewport, and see the prompt that created each one
- **FR-009**: System MUST allow users to delete sprites from the asset library
- **FR-010**: System MUST export individual sprites as PICT 2.0 files wrapped in MacBinary format (type `PICT`, creator `ttxt`) by shelling out to C tools: `grid2pict` (JSON → PICT 2.0) then `pict2macbin` (PICT → MacBinary)
- **FR-011**: System MUST export all sprites in a project as an HFS disk image (.dsk) containing every sprite as a native PICT file (type `PICT`, creator `ttxt`) in a project-named folder, by shelling out to `picts2dsk` (PICT files → HFS disk image). The tool uses libhfs (bundled from Retro68) to create the disk image and sets HFS file type/creator directly
- **FR-012**: System MUST support palettes of up to 256 colors compatible with Mac OS System 7+ standard system palette, with palette index 0 reserved as transparent
- **FR-013**: System MUST allow users to generate a project palette from a text prompt via the LLM (e.g., "military desert colors") and manually adjust individual colors using a color picker
- **FR-014**: System MUST use the project's palette when generating sprites by default. When the user opts out (e.g., a "use free colors" toggle), the LLM generates the sprite with any colors it deems relevant to the prompt, and the resulting palette is stored with the sprite
- **FR-015**: System MUST persist projects and sprites to the file system (no database)
- **FR-016**: System MUST run via `docker compose up` with no additional setup required

### Key Entities

- **Project**: A named workspace containing a color palette and a collection of assets. Stored as a directory on disk with a manifest file.
- **Sprite**: A palette-indexed 2D pixel grid with associated metadata (name, dimensions, generating prompt, creation date, parent sprite ID if iterated from another). Stored as JSON.
- **Palette**: An ordered list of up to 256 RGB colors defined per project. Index 0 is always transparent.

## Clarifications

### Session 2026-03-14

- Q: How should LLM model selection work? → A: Configurable via environment variable with sensible default. Only Anthropic models supported: latest Opus, Sonnet, and Haiku.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can go from opening the app to seeing their first generated sprite in under 2 minutes (excluding LLM response time)
- **SC-002**: Users can generate a variation of an existing sprite in under 30 seconds of interaction (excluding LLM response time)
- **SC-003**: Exported PICT files open correctly on classic Mac System 7+ (verified in emulator or real hardware)
- **SC-004**: The grid preview accurately represents the final exported image — every cell in the preview corresponds exactly to one pixel in the PICT output
- **SC-005**: The service starts with a single `docker compose up` command and is usable within 30 seconds of container startup
- **SC-006**: Sprite generation, iteration, and export all work the same way regardless of asset type (character, tile, map, projectile, obstacle — no special-case workflows)
