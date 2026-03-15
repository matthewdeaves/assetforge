# Tasks: Asset Forge Service

**Input**: Design documents from `/specs/001-asset-forge-service/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md

**Tests**: Not explicitly requested. Test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project reorganization, structure creation, Docker setup

- [x] T001 Archive legacy HTML files by moving index.html, game-assets.html, maps.html, export.html, export-sprites.js, make-macbinary.js, build-mac-resources.sh, and export/ to archive/
- [x] T002 Create project directory structure: server/, server/routes/, server/services/, public/, public/css/, public/js/, public/js/components/
- [x] T003 [P] Initialize Node.js project with Express dependency in server/package.json
- [x] T004 [P] Create Dockerfile that installs Node.js 20, compiles tools/grid2pict.c, tools/pict2macbin.c, and tools/picts2dsk.c (with libhfs) using gcc, installs binaries to /usr/local/bin, and copies server + public files
- [x] T005 [P] Create docker-compose.yml mapping port 3777, mounting data/ volume and openrouterkey file, passing OPENROUTER_API_KEY and OPENROUTER_MODEL env vars
- [x] T006 [P] Create .dockerignore and .gitignore (ignore node_modules, data/, *.pict, *.bin, *.dsk, temp files, openrouterkey)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Express server, rasterizer, grid renderer, API client, LLM service, frontend design system — shared by all user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T007 Create Express server entry point with static file serving from public/ and JSON body parsing in server/index.js
- [x] T008 [P] Create rasterizer service in server/services/rasterizer.js: implement rasterize(width, height, commands) that takes an array of drawing commands and returns a 2D pixel grid. Support command types: rect (filled rectangle), circle (filled circle using distance check), ellipse (filled ellipse), line (Bresenham's with thickness), polygon (filled using scanline), fill (flood fill from point). All coordinates clip to grid bounds, invalid palette indices clamp to 0. Commands execute in array order (painter's algorithm). Track skipped/malformed commands and return { pixels, warnings } where warnings is an array of { index, type, message } for each skipped command. Reference archive/game-assets.html for the drawing primitive style used in createTankSprite(), createObstacle(), etc.
- [x] T009 [P] Create OpenRouter LLM service in server/services/llm.js: implement generateSprite(prompt, palette, width, height, existingCommands) that sends a system prompt defining the available drawing command types with JSON schema examples, the palette with color descriptions, and grid dimensions. The LLM returns a JSON array of drawing commands. Also implement generatePalette(prompt) that returns an array of up to 256 RGB colors. Include robust JSON extraction (handle markdown code blocks in response). For iteration, include existingCommands in the prompt so the LLM can modify/extend them. For free-color mode (no palette), instruct the LLM to also return a palette alongside the commands. Default model: `anthropic/claude-sonnet-4-6` via OPENROUTER_MODEL env var
- [x] T010 [P] Create HTML shell in public/index.html with app structure, script tags for all JS modules, and a link to the CSS file. Use the frontend-design skill: choose a distinctive aesthetic direction appropriate for a retro Mac pixel-art forge tool. Include a Google Fonts link for distinctive typography
- [x] T011 [P] Create CSS in public/css/style.css using the frontend-design skill. The design must be distinctive and polished — NOT generic dark theme with monospace fonts. Choose a bold aesthetic direction (e.g., retro-futuristic, industrial/utilitarian, art deco, brutalist) appropriate for a pixel-art creation tool. Use creative font pairings, bold color accents, atmospheric backgrounds with texture/depth, and polished micro-interactions. Avoid Inter, Roboto, Arial, system fonts. Avoid generic purple-gradient-on-white. Every element should feel intentionally designed. Include styles for the persistent navigation/menu system (FR-004a): active states, breadcrumbs, workspace tab indicators
- [x] T012 [P] Create canvas-based grid renderer module in public/js/grid-renderer.js with drawSprite(canvas, pixels, palette, cellSize), drawOverlay(canvas, cellSize) showing pixel boundary lines, clear(), and drawThumbnail(canvas, pixels, palette, maxSize) methods
- [x] T013 [P] Create API client module in public/js/api.js with methods for all endpoints: getProjects, createProject, getProject, deleteProject, generatePalette, updatePalette, getSprites, getSprite, generateSprite, saveSprite, deleteSprite, exportSpriteUrl, exportProjectUrl
- [x] T014 Create main app module in public/js/app.js with view routing (project-list, project-workspace with tabs for generate/library/palette) and state management. Use the frontend-design skill to create a persistent, user-friendly navigation/menu system (FR-004a) that lets users move between views intuitively: persistent top/side nav always visible, current view clearly indicated with active state, breadcrumb or context indicator showing current project name, workspace tabs for Generate/Library/Palette views, export accessible from workspace. Wire navigation between views

**Checkpoint**: Server runs, serves static files, rasterizer converts drawing commands to pixel grids, grid renderer draws pixel data on canvas, LLM service ready, navigation/design system in place. No API routes yet.

---

## Phase 3: User Story 1 — Create a Project (Priority: P1) MVP

**Goal**: Users can create named projects and select them to start working

**Independent Test**: Open http://localhost:3777, create a project named "Tank Game", see it listed, select it, see empty workspace

### Implementation for User Story 1

- [x] T015 [US1] Implement file-system project storage service in server/services/projects.js: listProjects(), createProject(name, description, palette), getProject(id), deleteProject(id), updatePalette(id, palette). Projects stored in data/projects/{id}/manifest.json
- [x] T016 [US1] Create projects route in server/routes/projects.js: GET /api/projects (list), POST /api/projects (create with LLM palette generation from description, fallback to default palette), GET /api/projects/:id, DELETE /api/projects/:id
- [x] T017 [US1] Add PUT /api/projects/:id/palette and POST /api/projects/:id/palette/generate endpoints in server/routes/projects.js
- [x] T018 [US1] Register project routes in server/index.js
- [x] T019 [US1] Create project list component in public/js/components/project-list.js: show all projects with create form (name + description textarea + create button). When no projects exist, show encouraging empty state. On project select, navigate to workspace. Use the frontend-design skill for polished layout and interactions
- [x] T020 [US1] Create palette editor component in public/js/components/palette-editor.js: display palette swatches, allow editing individual colors via HTML color picker, LLM palette generation with prompt input
- [x] T021 [US1] Wire project list and palette editor into app.js workspace view

**Checkpoint**: User can create projects (with LLM-generated palette from description), see them listed, select one. File system has data/projects/{id}/manifest.json. User can edit project palettes.

---

## Phase 4: User Story 2 — Generate a Sprite from a Prompt (Priority: P1)

**Goal**: Users can enter a prompt + grid size, generate a sprite via LLM drawing commands, preview the rasterized result in the grid viewport, and save it

**Independent Test**: Select a project, enter "draw a top-down yellow tank with a big gun" with 64x64, click generate, see high-quality pixel grid preview with recognizable shapes, adjust zoom, toggle overlay, save to project

### Implementation for User Story 2

- [x] T022 [US2] Create sprites route in server/routes/sprites.js: POST /api/projects/:projectId/sprites/generate (calls LLM for drawing commands, rasterizes via rasterizer service, returns commands + pixels + palette + warnings without saving)
- [x] T023 [US2] Add POST /api/projects/:projectId/sprites (save sprite with commands, pixels, metadata) in server/routes/sprites.js
- [x] T024 [US2] Add useProjectPalette boolean support to the generate endpoint. When false, LLM chooses colors freely and returns palette alongside commands in server/routes/sprites.js
- [x] T025 [US2] Register sprite routes in server/index.js
- [x] T026 [US2] Create sprite generation component in public/js/components/sprite-gen.js: prompt textarea, width/height inputs (default 32x32), "use free colors" toggle, generate button with loading state showing elapsed time. On success, render preview using grid-renderer with zoom slider (2-8px) and grid overlay toggle. If rasterizer returned warnings, show warning count with details. Show save section with name input and save button. Use the frontend-design skill for polished layout
- [x] T027 [US2] Wire sprite-gen component into app.js workspace view

**Checkpoint**: Full generation loop works: prompt → LLM drawing commands → rasterize → preview → save. Sprites persist as JSON files with both commands and pixels. Free-color mode available. Rasterizer warnings shown to user.

---

## Phase 5: User Story 3 — Browse and Manage Asset Library (Priority: P2)

**Goal**: Users can browse saved sprites, view full previews with prompts, and delete sprites

**Independent Test**: After generating several sprites, browse the library, click one to see full preview + prompt, delete one

### Implementation for User Story 3

- [x] T028 [US3] Add GET /api/projects/:projectId/sprites (list without pixel data or commands), GET /api/projects/:projectId/sprites/:spriteId (full data), DELETE /api/projects/:projectId/sprites/:spriteId in server/routes/sprites.js
- [x] T029 [US3] Create library component in public/js/components/library.js: show sprite thumbnails (render each on small canvas using grid-renderer.drawThumbnail) in a grid with names. Click a thumbnail to show detail view with full-size grid preview + prompt text + zoom/overlay controls + delete button. Use the frontend-design skill for polished gallery layout
- [x] T030 [US3] Wire library component into app.js workspace view

**Checkpoint**: Users can browse, view, and delete sprites. Library and generation coexist in the workspace.

---

## Phase 6: User Story 4 — Iterate on Existing Sprite (Priority: P2)

**Goal**: Users can select an existing sprite and generate a variation with a new prompt

**Independent Test**: Select a yellow tank, click "Create variation", enter "make it blue", generate, see both sprites side by side, save the new one

### Implementation for User Story 4

- [x] T031 [US4] Update POST /api/projects/:projectId/sprites/generate to accept parentId: look up parent sprite's drawing commands, pass to LLM service as existingCommands context in server/routes/sprites.js
- [x] T032 [US4] Add "Create variation" button to library detail view in public/js/components/library.js that navigates to sprite-gen with parent sprite preloaded
- [x] T033 [US4] Update sprite-gen component to show original sprite alongside generated variation (side-by-side canvases) when iterating, and record parentId on save in public/js/components/sprite-gen.js

**Checkpoint**: Full iteration loop works. Original sprite unchanged, variation saved as new sprite with parentId and its own drawing commands.

---

## Phase 7: User Story 5 — Export Sprites as PICT (Priority: P3)

**Goal**: Users can export individual sprites as .bin (MacBinary) and all project sprites as .dsk (HFS disk image)

**Independent Test**: Export a single sprite as .bin, export all as .dsk, transfer both to Mac OS 7 (QemuMac Quadra 800), verify files open correctly

### Build picts2dsk C Tool

- [x] T034 [US5] Copy libhfs source from /home/matthew/Retro68/hfsutils/libhfs/ into tools/libhfs/ (only .c and .h files needed for linking)
- [x] T035 [US5] Write tools/picts2dsk.c: C tool that takes a volume name, folder name, and PICT file paths (with display names) as arguments. Creates HFS disk image (.dsk) with a project folder containing all PICT files with type PICT / creator ttxt set via hfs_setfinfo(). Uses libhfs. Size padded to 800KB multiples.
- [x] T036 [US5] Update tools/Makefile to compile picts2dsk (linking libhfs sources) alongside grid2pict and pict2macbin

### Export Service & Routes

- [x] T037 [US5] Create export service in server/services/export.js: exportSprite(sprite) writes sprite JSON (pixels+palette only) to temp file, shells out to grid2pict then pict2macbin, returns MacBinary data and cleans up. exportProject(project, sprites) converts all to PICT via grid2pict, then shells out to picts2dsk, returns .dsk data and cleans up.
- [x] T038 [US5] Create export routes in server/routes/export.js: GET /api/projects/:projectId/sprites/:spriteId/export (stream .bin), GET /api/projects/:projectId/export (stream .dsk). Both with Content-Disposition headers.
- [x] T039 [US5] Register export routes in server/index.js

### Export UI

- [x] T040 [US5] Add export button (single .bin) to library detail view and "Export All (.dsk)" button to workspace nav in public/js/components/library.js and public/js/app.js. Disable/hide export options when project has no sprites (edge case). Use the frontend-design skill for polished export UI
- [ ] T041 [US5] Verify exported .bin on QemuMac Quadra 800 (Mac OS 7.6.1) — test both 4-bit and 8-bit palette exports
- [ ] T042 [US5] Verify exported .dsk on QemuMac Quadra 800 (Mac OS 7.6.1) — mount disk image, confirm all PICT files present and open correctly

**Checkpoint**: Complete pipeline: prompt → drawing commands → rasterize → preview → save → export (.bin/.dsk) → opens on classic Mac.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T043 [P] Add error handling for OpenRouter API failures with user-friendly messages in server/services/llm.js
- [x] T044 [P] Add user-facing warning reporting when drawing commands are skipped: display count of malformed/skipped commands to the user after rasterization (core validation already in rasterizer.js — this task adds the UI reporting layer) in server/routes/sprites.js and public/js/components/sprite-gen.js
- [x] T045 Verify grid2pict, pict2macbin, and picts2dsk are compiled and available on PATH in the running container
- [x] T046 Validate full docker-compose workflow: build, up, create project, generate sprite, export PICT
- [ ] T047 Run quickstart.md validation — confirm all steps work as documented
- [ ] T048 Validate success criteria timing: SC-001 (first sprite in <2min interaction), SC-002 (variation in <30s interaction), SC-004 (grid preview matches PICT export pixel-for-pixel)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — no dependencies on other stories
- **US2 (Phase 4)**: Depends on Foundational + US1 (needs project to exist)
- **US3 (Phase 5)**: Depends on US2 (needs sprites to browse)
- **US4 (Phase 6)**: Depends on US2 + US3 (needs sprites + browsing)
- **US5 (Phase 7)**: Depends on US2 (needs sprites to export). Can parallel with US3/US4.
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Create Project)**: Independent — first story
- **US2 (Generate Sprite)**: Needs US1
- **US3 (Browse Library)**: Needs US2
- **US4 (Iterate Sprite)**: Needs US2 + US3
- **US5 (Export PICT)**: Needs US2. Can parallel with US3/US4.

### Parallel Opportunities

- T003, T004, T005, T006 (Setup phase)
- T008, T009, T010, T011, T012, T013 (Foundational phase — all independent files)
- T043, T044 (Polish phase)
- US5 (Export) can run in parallel with US3/US4 after US2

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (rasterizer + frontend design system are the key new components)
3. Complete Phase 3: US1 — Create Project
4. Complete Phase 4: US2 — Generate Sprite with Drawing Commands
5. **STOP and VALIDATE**: Generate a 64x64 sprite, verify quality is dramatically better than raw pixel arrays

### Incremental Delivery

1. Setup + Foundational → Server runs, rasterizer works, design system in place
2. Add US1 → Projects work
3. Add US2 → Generation via drawing commands works (MVP!)
4. Add US3 → Browse library
5. Add US4 → Iteration works
6. Add US5 → Export to Mac works (full pipeline!)
7. Polish → Error handling, warning reporting, Docker validation, SC timing validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Port 3777 (configured in docker-compose.yml)
- LLM model configurable via OPENROUTER_MODEL env var, default to `anthropic/claude-sonnet-4-6`
- Only Anthropic models supported: Opus, Sonnet, Haiku (via OpenRouter model resolution)
- grid2pict, pict2macbin, and picts2dsk binaries must be compiled in Docker build stage
- **FRONTEND**: Use frontend-design skill for all UI work (T010, T011, T014, T019, T026, T029, T040). Distinctive design with intuitive navigation/menu system (FR-004a), not generic
- Commit after each task or logical group
