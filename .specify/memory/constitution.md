# Tanks Asset Forge Constitution

## Scope

This service does ONE thing: **generate visual game assets for
classic Macintosh using an LLM, preview them in a browser, and
export them as PICT files that work on a real classic Mac.**

The pipeline is: **Prompt → LLM generates grid-format sprite →
browser preview → save → export as PICT (.bin single / .dsk bulk)
→ transfer to Mac.**

Everything in this constitution serves that pipeline. If a feature
does not directly support a step in this pipeline, it is out of
scope.

## Core Principles

### I. LLM-Powered Grid Sprite Generation

The LLM MUST generate sprites as **palette-indexed 2D pixel grids**
— arrays of integer color indices.

- All LLM calls go through the **OpenRouter SDK**.
- The prompt includes the project's palette definition and target
  dimensions so the LLM outputs valid grid data.
- **Palette**: projects use a palette compatible with the **Mac OS
  System 7+ standard system palette** (up to 256 colors). The
  palette is defined per project and included in LLM prompts by
  default. When a user explicitly opts for **free-color mode**,
  the project palette is omitted and the LLM chooses its own
  colors; the resulting palette is stored with the sprite.
  Palette index 0 is reserved as the **transparent color**.
- Asset types are all just sprites at different scales:
  - Characters, vehicles, projectiles, explosions, items, effects
  - Ground tiles, terrain, repeating patterns
  - Obstacles, scenery, barriers
  - Maps/backgrounds (larger sprites or tiles meant to repeat)
- The LLM does NOT generate raster images. It generates structured
  pixel data that the browser renders using the grid system.
- Keep LLM interaction simple: tell the LLM the grid size and what
  to draw. Do NOT over-engineer output validation — a clear prompt
  with palette and dimensions is sufficient.
- **Iteration workflow**: users start with zero sprites and build
  up a library through prompting. A user can select an existing
  sprite as a **starting point** for a new prompt — the existing
  sprite's grid data is included in the LLM prompt so the LLM can
  produce a variation (e.g., recolor, next animation frame,
  alternate pose). Each prompt always produces a **new** sprite;
  originals are never overwritten. Directional variants (rotation)
  are handled by the game program at runtime, not by generating
  separate sprites.

### II. Browser Preview via Scaled Grid System

The grid system is a **pixel-art authoring viewport** for modern
high-resolution screens. A 32x32 sprite is a 32x32 array of palette
indices — far too small to see or work with on a modern display.
The grid scales each logical pixel up to a visible cell size
(2-8px per cell) so users can create and review pixel art at a
comfortable size. The underlying data is always the true
resolution (e.g., 32x32). On export, each grid cell becomes
exactly one real pixel in the PICT file.

Every generated asset MUST be viewable in the browser before export,
using this scaled grid rendering:

- **CSS grid or canvas rendering** where each palette index maps to
  a colored cell at adjustable scale (2-8px per cell = per pixel).
- **Grid overlay toggle** with major lines every 8 pixels.
- The preview is a scaled-up view of the real data — what you see
  in the grid at 32 cells wide IS a 32-pixel-wide sprite.
- Assets MUST be saveable to the project (persisted to disk) from
  the browser preview.

### III. Classic Mac Export

Saved assets are exported as **standalone PICT files** wrapped in
MacBinary for transfer to a classic Mac.

**PICT is the standard Mac image format.** System 7+ natively
understands PICT files — they open in SimpleText, TeachText, and
any application that handles pictures. No custom resource types,
no custom unpacking code needed on the Mac side.

**Export output:**

Each sprite exports as a **MacBinary (.bin) file** containing:
- Data fork: PICT 2.0 data with 512-byte file header
- File type: `PICT`, creator: `ttxt`
- The file opens directly on a classic Mac as a picture

**Export tooling:**

- **`grid2pict`** (`tools/grid2pict.c`) — C tool that converts
  a JSON sprite (palette + 2D pixel array) into a valid PICT 2.0
  file. Supports 4-bit (16 color) and 8-bit (256 color) indexed
  palettes with PackBits compression. *(already built)*
- **`pict2macbin`** (`tools/pict2macbin.c`) — C tool that wraps
  PICT files into MacBinary with proper type/creator codes.
  *(already built)*
- **`picts2dsk`** (`tools/picts2dsk.c`) — C tool that takes
  multiple PICT files and creates an HFS disk image (.dsk)
  containing them all. Uses libhfs (bundled from Retro68's
  `hfsutils/libhfs/`). *(to be built)*
- `grid2pict` and `pict2macbin` are pure C with no external
  dependencies. `picts2dsk` depends on bundled libhfs.

**Export pipelines:**

*Single sprite (.bin):*

1. Take sprite's pixel grid data (JSON: palette + 2D array)
2. `grid2pict` converts to PICT 2.0 (indexed color, PackBits
   compressed, embedded color table)
3. `pict2macbin` wraps in MacBinary (.bin) with type `PICT` /
   creator `ttxt`
4. Transfer .bin to classic Mac — double-click opens the image

*All project sprites (.dsk):*

1. Convert each sprite to PICT 2.0 via `grid2pict` (named
   `{SpriteName}`)
2. `picts2dsk` creates an HFS disk image with a folder named
   after the project, containing all PICT files with type `PICT`
   / creator `ttxt` set via HFS file info (variable size, padded
   to 800KB multiples)
3. Transfer .dsk to classic Mac — mounts as a disk volume with
   a project folder containing all sprites as native PICT files

PNG is NOT a classic Mac format. PNG may be used for web preview
in the browser but MUST NOT be presented as a Mac export option.

### IV. Project Organization

Users work within game projects. Each project has its own palette,
asset library, and export settings. Keep it simple — a project is
a directory on disk with a manifest file, sprites saved as JSON
grid data, and an export output folder.

### V. Docker-First

The service MUST run via `docker compose up`. The container includes
the web server, OpenRouter integration, and the C export tools
(`grid2pict`, `pict2macbin`, `picts2dsk`) compiled in the container.

### VI. No Scope Creep

This is a sprite generation and export tool. It is NOT:

- A game engine or game runtime
- A sprite editor (the LLM generates, users don't hand-draw)
- A collaboration platform
- An asset marketplace

Maps are in scope — they are just sprites at a different scale.
Map *layout editing* (a level editor) is out of scope.

No auth system, no user accounts, no microservices, no ORM, no SPA
framework. File-based storage. Single service. Add complexity only
when the pipeline from prompt to PICT demands it.

## Classic Mac Format Reference

### PICT 2.0

All assets export as **PICT 2.0 files** — the color version of
the standard Mac picture format, compatible with Mac II onwards
(System 7+). Each PICT contains:

- QuickDraw `PackBitsRect` opcode with indexed color bitmap
- Embedded color table (project palette, up to 256 colors)
- PackBits compression on scanlines
- 72 dpi resolution

On a classic Mac, PICT files open natively. For game use, load
with `GetPicture()` or read from data fork, draw into a GWorld,
render with `CopyBits()`.

Dimensions are project-configurable. Default sizes for the tank
game: sprites 64x64, tiles 32x32, projectiles 16x16, maps
variable.

### Sprite JSON Format (internal)

Sprites are stored internally as JSON:
```json
{
  "width": 64,
  "height": 64,
  "palette": [
    { "r": 0, "g": 0, "b": 0 },
    { "r": 255, "g": 68, "b": 68 },
    ...
  ],
  "pixels": [
    [0, 0, 1, 1, ...],
    [0, 1, 2, 3, ...],
    ...
  ]
}
```

This is the format the LLM outputs, the browser previews, and
`grid2pict` consumes. Palette index 0 = transparent.

### Pipeline Detail

1. User prompts: "draw a top-down crate, 32x32" (from scratch)
   — OR selects an existing sprite and prompts: "make it blue"
   (iteration — existing grid data sent to LLM as context)
2. Service sends prompt + palette + dimensions (+ existing sprite
   data if iterating) to OpenRouter
3. LLM returns 2D array of palette indices → new sprite created
4. Browser renders grid preview (CSS grid or canvas)
5. User reviews, adjusts scale, checks with grid overlay
6. User saves sprite to project (original unchanged if iterating)
7. On single export: `grid2pict` converts JSON → PICT 2.0,
   then `pict2macbin` wraps as MacBinary (.bin)
8. On bulk export: `grid2pict` converts all sprites → PICT,
   then `picts2dsk` packages into HFS disk image (.dsk) with
   native PICT files (type/creator set via HFS file info)
9. Transfer .bin or .dsk to classic Mac — files open natively

### Reference Materials

- Books: `/home/matthew/Downloads/text_output/` (6 classic Mac
  game programming references)
- Existing HTML tools: `index.html`, `game-assets.html`,
  `maps.html`, `export.html` — reference grid rendering
- Export tools: `tools/grid2pict.c`, `tools/pict2macbin.c`
- Test data: `tools/test_sprite.json`

## Technology Constraints

- **Runtime**: Node.js
- **Container**: Docker with docker-compose
- **LLM**: OpenRouter SDK
- **Export tools**: `grid2pict` and `pict2macbin` (pure C, no
  external dependencies), `picts2dsk` (C, depends on bundled
  libhfs) — all compiled in Docker container
- **Frontend**: HTML/CSS/JS with grid rendering (no framework)
- **Storage**: File-system per-project directories

## Development Workflow

- Specify workflow: spec → plan → tasks
- Test against Docker container before merging
- Verify export correctness: open .bin on classic Mac or emulator
  (Mini vMac, Basilisk II, or SheepShaver)
- Existing HTML tools are reference implementations for the grid
  rendering approach
- One logical change per commit

## Governance

This constitution defines the project's non-negotiable principles.
All specs and plans MUST pass a constitution check. Amendments need:

1. Documented rationale
2. Semver version bump (MAJOR for redefinitions, MINOR for additions,
   PATCH for clarifications)
3. Template updates if principle names or rules change

**Version**: 1.1.0 | **Ratified**: 2026-03-14 | **Last Amended**: 2026-03-14
