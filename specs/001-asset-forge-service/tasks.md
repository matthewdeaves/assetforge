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

- [ ] T001 Archive legacy HTML files by moving index.html, game-assets.html, maps.html, export.html, export-sprites.js, make-macbinary.js, build-mac-resources.sh, and export/ to archive/
- [ ] T002 Create project directory structure: server/, server/routes/, server/services/, public/, public/css/, public/js/, public/js/components/
- [ ] T003 [P] Initialize Node.js project with Express dependency in server/package.json
- [ ] T004 [P] Create Dockerfile that installs Node.js 20, compiles tools/grid2pict.c, tools/pict2macbin.c, and tools/picts2dsk.c (with libhfs) using gcc, installs binaries to a directory on PATH (e.g., /usr/local/bin), and copies server + public files
- [ ] T005 [P] Create docker-compose.yml mapping port 3777 and mounting data/ volume, reading OPENROUTER_API_KEY from the `openrouterkey` file in project root (use env_file or a shell variable expansion)
- [ ] T006 [P] Create .dockerignore and .gitignore (ignore node_modules, data/, *.pict, *.bin temp files, openrouterkey)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Express server, static file serving, grid renderer, API client — shared by all user stories

**CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Create Express server entry point with static file serving from public/ and JSON body parsing in server/index.js
- [ ] T008 [P] Create HTML shell with dark theme layout, navigation placeholder, and content area in public/index.html
- [ ] T009 [P] Create base CSS with dark theme (background #1a1a2e), monospace font, and layout styles in public/css/style.css
- [ ] T010 [P] Create canvas-based grid renderer module with drawSprite(canvas, pixels, palette, cellSize), drawOverlay(canvas, cellSize), and clear() methods in public/js/grid-renderer.js
- [ ] T011 [P] Create API client module with methods for all endpoints (getProjects, createProject, getSprites, generateSprite, saveSprite, deleteSprite, exportSprite, exportProject, generatePalette, updatePalette) in public/js/api.js
- [ ] T019 [P] Create OpenRouter LLM service in server/services/llm.js: set up OpenRouter SDK client, implement generateSprite(prompt, palette, width, height) that sends system prompt with palette definition and dimensions, parses response as 2D integer array. Also implement generatePalette(prompt) that sends a palette description prompt and returns an array of up to 256 RGB colors (index 0 = transparent).
- [ ] T012 Create main app module with view routing (project-list, project-workspace) and state management in public/js/app.js

**Checkpoint**: Server runs, serves static files, grid renderer draws pixel data on canvas, LLM service ready. No API routes yet.

---

## Phase 3: User Story 1 - Create a Project (Priority: P1) MVP

**Goal**: Users can create named projects and select them to start working

**Independent Test**: Open http://localhost:3777, create a project named "Tank Game", see it listed, select it, see empty workspace

### Implementation for User Story 1

- [ ] T013 [US1] Create projects route with GET /api/projects (list) and POST /api/projects (accepts name + description, calls LLM to generate initial 16-color palette from description) in server/routes/projects.js
- [ ] T014 [US1] Create GET /api/projects/:id and DELETE /api/projects/:id endpoints in server/routes/projects.js
- [ ] T015 [US1] Implement file-system project storage: create project directory in data/projects/{id}/ with manifest.json containing id, name, description, createdAt, and palette in server/services/projects.js
- [ ] T016 [US1] Register project routes in server/index.js
- [ ] T017 [US1] Create project list component showing all projects with a create form (name input + description textarea + create button) in public/js/components/project-list.js. When no projects exist, show a prompt encouraging the user to create their first project
- [ ] T018 [US1] Wire project list into app.js: show on startup, navigate to workspace on project select

### Palette Editing (non-LLM)

- [ ] T051 [US1] Add PUT /api/projects/:id/palette endpoint that accepts an updated palette array and saves it to the project manifest in server/routes/projects.js
- [ ] T052 [US1] Create palette editor component in public/js/components/palette-editor.js: display palette swatches, allow editing individual colors via an HTML color picker input, and a placeholder button for LLM palette generation (wired in Phase 4 after LLM service exists)
- [ ] T053 [US1] Wire palette editor into the project workspace view in public/js/app.js so users can access it after selecting a project

**Checkpoint**: User can create projects (with LLM-generated palette from description), see them listed, select one. File system has data/projects/{id}/manifest.json. User can manually edit project palettes.

---

## Phase 4: User Story 2 - Generate a Sprite from a Prompt (Priority: P1)

**Goal**: Users can enter a prompt + grid size, generate a sprite via LLM, preview it in the grid viewport, and save it

**Independent Test**: Select a project, enter "draw a yellow tank" with 64x64, click generate, see pixel grid preview, adjust zoom, toggle overlay, save to project

### Implementation for User Story 2

- [ ] T050 [US1] Add POST /api/projects/:id/palette/generate endpoint that calls llm.generatePalette() and returns the generated palette in server/routes/projects.js. Wire the generate button in palette-editor.js to call this endpoint.
- [ ] T020 [US2] Create sprites route with POST /api/projects/:projectId/sprites/generate (calls LLM, returns pixel data without saving) in server/routes/sprites.js
- [ ] T021 [US2] Add POST /api/projects/:projectId/sprites (save sprite JSON to data/projects/{id}/sprites/{spriteId}.json) in server/routes/sprites.js
- [ ] T022 [US2] Register sprite routes in server/index.js
- [ ] T023 [US2] Create sprite generation component with prompt textarea, width/height inputs, generate button, and loading state in public/js/components/sprite-gen.js
- [ ] T024 [US2] Integrate grid-renderer into sprite-gen: render returned pixel data on canvas with zoom slider (2-8px) and grid overlay toggle
- [ ] T025 [US2] Add save button to sprite-gen that calls save endpoint with sprite data, prompt, and user-provided name
- [ ] T026 [US2] Wire sprite-gen component into app.js workspace view
- [ ] T054 [US2] Add "use free colors" toggle to sprite generation component in public/js/components/sprite-gen.js. When toggled on, the generate request omits the project palette so the LLM picks colors freely. The returned sprite stores its own palette.
- [ ] T055 [US2] Update LLM service in server/services/llm.js to handle free-color mode: when no palette is provided, instruct the LLM to choose appropriate colors and return both the palette and the pixel grid
- [ ] T056 [US2] Update POST /api/projects/:projectId/sprites/generate to accept an optional `useProjectPalette` boolean (default true). When false, omit palette from LLM prompt in server/routes/sprites.js

**Checkpoint**: Full generation loop works: prompt → LLM → preview → save. Sprites persist as JSON files. Free-color mode available.

---

## Phase 5: User Story 3 - Browse and Manage Asset Library (Priority: P2)

**Goal**: Users can browse saved sprites, view full previews with prompts, and delete sprites

**Independent Test**: After generating several sprites, browse the library, click one to see full preview + prompt, delete one

### Implementation for User Story 3

- [ ] T027 [US3] Add GET /api/projects/:projectId/sprites (list sprites without pixel data, return id, name, width, height, prompt, createdAt) in server/routes/sprites.js
- [ ] T028 [US3] Add GET /api/projects/:projectId/sprites/:spriteId (return full sprite with pixel data) in server/routes/sprites.js
- [ ] T029 [US3] Add DELETE /api/projects/:projectId/sprites/:spriteId (remove sprite JSON file) in server/routes/sprites.js
- [ ] T030 [US3] Create library component showing sprite thumbnails (render each on small canvas) with names in public/js/components/library.js
- [ ] T031 [US3] Add sprite detail view: clicking a thumbnail shows full-size grid preview + prompt text + delete button in public/js/components/library.js
- [ ] T032 [US3] Wire library component into app.js workspace view alongside sprite-gen

**Checkpoint**: Users can browse, view, and delete sprites. Library and generation coexist in the workspace.

---

## Phase 6: User Story 4 - Iterate on Existing Sprite (Priority: P2)

**Goal**: Users can select an existing sprite and generate a variation with a new prompt

**Independent Test**: Select a yellow tank, click "Create variation", enter "make it blue", generate, see both sprites side by side, save the new one

### Implementation for User Story 4

- [ ] T033 [US4] Update LLM service to accept optional existingPixels parameter — include existing sprite grid data in the system prompt as context for the LLM in server/services/llm.js
- [ ] T034 [US4] Update POST /api/projects/:projectId/sprites/generate to accept parentId, look up parent sprite data, pass to LLM service in server/routes/sprites.js
- [ ] T035 [US4] Add "Create variation" button to library sprite detail view that navigates to sprite-gen with parent sprite preloaded in public/js/components/library.js
- [ ] T036 [US4] Update sprite-gen component to show original sprite alongside the generated variation when iterating (side-by-side canvases) in public/js/components/sprite-gen.js
- [ ] T037 [US4] Ensure saved variation records parentId linking it to the original sprite in public/js/components/sprite-gen.js

**Checkpoint**: Full iteration loop works. Original sprite unchanged, variation saved as new sprite with parentId.

---

## Phase 7: User Story 5 - Export Sprites as PICT (Priority: P3)

**Goal**: Users can export individual sprites as .bin (MacBinary) and all project sprites as .dsk (HFS disk image) for transfer to classic Mac

**Independent Test**: Export a single sprite as .bin, export all project sprites as .dsk, transfer both to Mac OS 7 (QemuMac Quadra 800), verify .bin opens as PICT and .dsk mounts as a volume with all PICTs inside

### Build picts2dsk C Tool

- [ ] T057 [US5] Copy libhfs source from /home/matthew/Retro68/hfsutils/libhfs/ into tools/libhfs/ (only the .c and .h files needed for linking)
- [ ] T058 [US5] Write tools/picts2dsk.c — C tool that takes a volume name, a folder name, and one or more PICT file paths (with display names) as arguments. Creates an HFS disk image (.dsk) with a folder named after the project inside, containing all PICT files as native HFS files with type `PICT` / creator `ttxt` set via hfs_setfinfo(). Uses libhfs for HFS filesystem creation. Size is variable (padded to 800KB multiples). No MacBinary wrapping — files are native on the HFS volume.
- [ ] T059 [US5] Update tools/Makefile to compile picts2dsk (linking libhfs sources) alongside grid2pict and pict2macbin

### Single Sprite Export (.bin)

- [ ] T038 [US5] Create export service with exportSprite() that writes sprite JSON to temp file, shells out to grid2pict to create PICT, then shells out to pict2macbin to wrap as MacBinary (type PICT, creator ttxt), streams result and cleans up temp files in server/services/export.js
- [ ] T039 [US5] Create export route GET /api/projects/:projectId/sprites/:spriteId/export that streams MacBinary file as download with Content-Disposition header in server/routes/export.js

### Bulk Project Export (.dsk)

- [ ] T060 [US5] Add exportProject() to export service that converts all project sprites to PICT via grid2pict (named {SpriteName}), then shells out to picts2dsk with the project name as volume name/folder and all PICT files as arguments, streams the .dsk result and cleans up temp files in server/services/export.js
- [ ] T061 [US5] Create export route GET /api/projects/:projectId/export that streams HFS disk image as download with Content-Disposition header (filename: {ProjectName}.dsk) in server/routes/export.js

### Export UI & Wiring

- [ ] T040 [US5] Register export routes in server/index.js
- [ ] T041 [US5] Create export component with single-sprite export button on sprite detail view and "Export All" button on project workspace that triggers .dsk download in public/js/components/export.js. Disable or hide export buttons when the project has no saved sprites
- [ ] T042 [US5] Wire export buttons into library sprite detail view and project workspace in public/js/components/library.js
- [ ] T043 [US5] Verify exported .bin on QemuMac Quadra 800 (Mac OS 7.6.1) using tools/copy-to-shared.sh — test both 4-bit (16-color palette) and 8-bit (256-color palette) exports
- [ ] T062 [US5] Verify exported .dsk on QemuMac Quadra 800 (Mac OS 7.6.1) — mount disk image, confirm all PICT files are present and open correctly. Test with both 4-bit and 8-bit palette sprites

**Checkpoint**: Complete pipeline works: prompt → generate → preview → save → export (.bin single, .dsk bulk) → opens on classic Mac.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T044 [P] Add loading spinner/indicator during LLM generation in public/js/components/sprite-gen.js
- [ ] T045 [P] Add error handling for OpenRouter API failures with user-friendly messages in server/services/llm.js
- [ ] T046 [P] Add edge case handling: detect non-JSON LLM responses, clamp out-of-range palette indices to 0, validate grid dimensions match requested width/height in server/routes/sprites.js
- [ ] T047 Verify grid2pict, pict2macbin, and picts2dsk are compiled and available on PATH in the running container (run `which grid2pict && which pict2macbin && which picts2dsk` inside container)
- [ ] T048 Validate full docker-compose workflow: build, up, create project, generate sprite, export PICT
- [ ] T049 Run quickstart.md validation — confirm all steps work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational — no dependencies on other stories
- **US2 (Phase 4)**: Depends on Foundational + US1 (needs project to exist to generate sprites in it)
- **US3 (Phase 5)**: Depends on US2 (needs sprites to exist to browse them)
- **US4 (Phase 6)**: Depends on US2 + US3 (needs sprites + browsing to select one for iteration)
- **US5 (Phase 7)**: Depends on US2 (needs sprites to export). Can parallel with US3/US4.
- **Polish (Phase 8)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (Create Project)**: Independent — first story to implement
- **US2 (Generate Sprite)**: Needs US1 (a project must exist)
- **US3 (Browse Library)**: Needs US2 (sprites must exist to browse)
- **US4 (Iterate Sprite)**: Needs US2 + US3 (needs generation + browsing)
- **US5 (Export PICT)**: Needs US2 (needs sprites). Can parallel with US3/US4.

### Within Each User Story

- Server routes before frontend components
- Services before routes (where applicable)
- Core functionality before UI polish

### Parallel Opportunities

- T003, T004, T005, T006 can all run in parallel (Setup phase)
- T008, T009, T010, T011, T019 can all run in parallel (Foundational phase)
- T044, T045, T046 can all run in parallel (Polish phase)
- US5 (Export) can run in parallel with US3/US4 after US2 completes

---

## Parallel Example: User Story 2

```bash
# After T019 (LLM service) and T020-T022 (server routes) are done:
# Launch frontend tasks in parallel:
Task: "T023 Create sprite generation component in public/js/components/sprite-gen.js"
Task: "T024 Integrate grid-renderer into sprite-gen"
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup (archive, structure, Docker)
2. Complete Phase 2: Foundational (server, renderer, API client)
3. Complete Phase 3: US1 — Create Project
4. Complete Phase 4: US2 — Generate Sprite
5. **STOP and VALIDATE**: Can create project, generate sprite, see preview, save it
6. This is usable even without browsing, iteration, or export

### Incremental Delivery

1. Setup + Foundational → Server runs, serves UI
2. Add US1 → Projects work
3. Add US2 → Generation works (MVP!)
4. Add US3 → Browse library
5. Add US4 → Iteration works
6. Add US5 → Export to Mac works (full pipeline!)
7. Polish → Error handling, loading states, Docker validation

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story
- Port 3777 (configured in docker-compose.yml)
- LLM model configurable via OPENROUTER_MODEL env var, default to Anthropic Sonnet
- Only Anthropic models supported: Opus, Sonnet, Haiku (latest versions via OpenRouter)
- grid2pict, pict2macbin, and picts2dsk binaries must be compiled in Docker build stage
- Commit after each task or logical group
