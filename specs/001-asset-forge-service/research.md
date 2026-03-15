# Research: Asset Forge Service

## R-001: OpenRouter SDK for Node.js

**Decision**: Use direct HTTP calls to the OpenRouter API (OpenAI-compatible chat completions endpoint).

**Rationale**: OpenRouter provides a unified API across multiple LLM providers. The API is OpenAI-compatible, so we can use `fetch()` with the standard chat completions endpoint. No heavy SDK needed — a simple HTTP POST with JSON body.

**Alternatives considered**:
- Direct OpenAI SDK: Locked to one provider, OpenRouter gives model flexibility
- Anthropic SDK: Same issue — OpenRouter abstracts the provider choice

**Key details**:
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `Authorization: Bearer $OPENROUTER_API_KEY`
- The system prompt includes the palette definition, grid dimensions, and available drawing commands
- The LLM response must be parsed as a JSON array of drawing command objects
- Model selection configurable (default to a capable model for structured output)

## R-002: Drawing Commands Approach for Sprite Generation

**Decision**: Have the LLM output structured drawing commands (shape primitives) instead of raw pixel arrays. The server rasterizes these commands into pixel grids.

**Rationale**: Testing showed that asking an LLM to output raw 2D pixel arrays (e.g., 64x64 = 4,096 integers) produces low-quality, incoherent sprites. The LLM cannot reason about spatial relationships at the individual pixel level. However, the reference sprites in `archive/game-assets.html` were built procedurally using geometric primitives (`rect()`, `circle()`, `ellipse()`) and looked excellent. This approach leverages what LLMs are good at — reasoning about shapes, composition, and layering — while letting deterministic code handle the pixel-level rendering.

**Alternatives considered**:
- Raw pixel arrays: Tested and rejected — produced "crap" quality sprites (user's assessment)
- Image generation API (DALL-E, etc.): Would produce raster images, not palette-indexed pixel art compatible with PICT export
- SVG intermediary: Unnecessary indirection — drawing commands map directly to pixel grid operations

**Drawing command types**:
- `rect`: Filled rectangle — `{ type: "rect", x, y, w, h, color }`
- `circle`: Filled circle — `{ type: "circle", cx, cy, r, color }`
- `ellipse`: Filled ellipse — `{ type: "ellipse", cx, cy, rx, ry, color }`
- `line`: Line between two points — `{ type: "line", x1, y1, x2, y2, color, thickness? }`
- `polygon`: Filled polygon — `{ type: "polygon", points: [{x,y},...], color }`
- `fill`: Flood fill from a point — `{ type: "fill", x, y, color }`

**Execution semantics**:
- Commands execute in array order (painter's algorithm — later commands draw over earlier ones)
- Grid starts as all zeros (transparent)
- Coordinates are in pixel space (0,0 = top-left)
- Drawing clips to grid bounds (out-of-bounds portions silently ignored)
- Invalid palette indices clamped to 0

**LLM prompt strategy**:
- System prompt defines available commands with examples
- Include palette with color descriptions (not just RGB values) so the LLM knows what index 3 looks like
- Include grid dimensions
- For iteration: include the parent sprite's drawing commands so the LLM can modify/extend them
- Request JSON array output only, no explanation

## R-003: Grid Viewport Rendering

**Decision**: Use HTML5 Canvas for grid rendering.

**Rationale**: CSS grid with thousands of DOM elements (e.g., 64x64 = 4,096 divs) performs poorly. Canvas draws the same grid with a single element and much better performance, especially at larger sprite sizes.

**Alternatives considered**:
- CSS Grid: Works for small sprites but DOM overhead becomes an issue at 64x64+
- WebGL: Overkill for indexed-color pixel rendering

**Key details**:
- Canvas draws colored rectangles at the current zoom scale
- Grid overlay drawn as lines at pixel boundaries on top of the pixel data
- Zoom changes just redraw at different cell size — no interpolation
- Palette colors mapped from the project's palette definition

## R-004: File System Storage Layout

**Decision**: Each project is a directory with a manifest.json and a sprites/ subdirectory containing individual sprite JSON files.

**Rationale**: Simple, inspectable, no database dependency. Aligns with constitution principle IV. Projects identified by UUID. Sprites identified by UUID.

**Key details**:
- `data/projects/{project-id}/manifest.json` — project name, description, palette, creation date
- `data/projects/{project-id}/sprites/{sprite-id}.json` — sprite data with drawing commands, rasterized pixels, and metadata
- The `data/` directory is a Docker volume for persistence

## R-005: Export Pipeline Integration

**Decision**: Server shells out to C tools: `grid2pict` (JSON → PICT) then `pict2macbin` (PICT → MacBinary). For bulk: `picts2dsk` (PICT files → HFS disk image). The rasterized pixel grid (not drawing commands) is what gets exported.

**Rationale**: All tools are pure C with no dependencies (except picts2dsk which uses bundled libhfs), already compiled in the Docker container. Using them keeps the export logic in one place. The tools consume the standard sprite JSON format (palette + pixels array).

**Alternatives considered**:
- MacBinary wrapping in Node.js: Duplicates logic already in pict2macbin.c
- Rewrite tools in Node.js: Duplicates working, verified C code

## R-006: Docker Setup

**Decision**: Single Dockerfile based on Node.js 20 LTS, with gcc installed to compile the C tools during build.

**Rationale**: The C tools have minimal dependencies — just `gcc` to compile. The compiled binaries live in the container alongside the Node.js server.

**Key details**:
- Base image: `node:20-slim`
- Build stage: install `gcc`, compile `grid2pict`, `pict2macbin`, `picts2dsk` (linking bundled libhfs)
- Runtime: Node.js server + compiled binaries
- `docker-compose.yml` maps port, mounts `data/` volume, mounts `openrouterkey` file
- `OPENROUTER_API_KEY` passed as environment variable (fallback: read from mounted file)

## R-007: Project Reorganization

**Decision**: Move legacy HTML files to `archive/` directory.

**Rationale**: The existing HTML files are standalone reference implementations with hardcoded sprite data. They informed the design (especially the drawing-commands approach from `game-assets.html`) but the service replaces their functionality.

**Files to archive**:
- `index.html`, `game-assets.html`, `maps.html`, `export.html`
- `export-sprites.js`, `make-macbinary.js`, `build-mac-resources.sh`
- `export/` directory

## R-008: Rasterizer Design

**Decision**: Server-side JavaScript rasterizer that executes drawing commands onto a 2D array.

**Rationale**: The rasterizer is simple — it needs to support filled rectangles, circles, ellipses, lines, polygons, and flood fill on an integer grid. This is straightforward geometry code with no external dependencies. Running it server-side means the pixel grid is available immediately for storage and export without a browser round-trip.

**Key details**:
- Input: width, height, array of drawing commands
- Output: 2D array of palette indices (height rows × width columns)
- Grid initialized to all zeros (transparent)
- Commands executed in order (painter's algorithm)
- Bounds checking: coordinates clipped to grid dimensions
- Circle/ellipse: midpoint algorithm or brute-force distance check (grid sizes are small, performance is not critical)

## R-009: Frontend Design Approach

**Decision**: Use the `frontend-design` skill to create a distinctive, polished interface that avoids generic AI aesthetics.

**Rationale**: The first implementation used generic dark-theme styling with default monospace fonts, bland color schemes, and cookie-cutter layouts. The user explicitly rejected this. The frontend-design skill provides guidelines for creating memorable, intentional design with creative typography, bold color choices, atmospheric backgrounds, and polished interactions.

**Key details**:
- Choose a distinctive aesthetic direction appropriate for a retro Mac pixel-art tool
- Use creative font choices (not Inter, Roboto, Arial)
- Bold color palette with sharp accents
- Atmospheric backgrounds and visual details
- Polished micro-interactions and loading states
- The design should feel like a tool made for creative work, not a generic admin panel
