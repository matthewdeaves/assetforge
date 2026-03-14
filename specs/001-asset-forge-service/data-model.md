# Data Model: Asset Forge Service

## Entities

### Project

A named workspace grouping assets with a shared palette.

```
Project
├── id: string (UUID)
├── name: string (user-provided, e.g., "Tank Game")
├── description: string (game/theme description used for initial palette generation)
├── createdAt: ISO 8601 datetime
├── palette: Palette
└── sprites: Sprite[] (via directory listing)
```

**Storage**: `data/projects/{id}/manifest.json`

**Validation**:
- Name must be non-empty, max 100 characters
- Description must be non-empty
- Palette must have at least 2 colors, max 256
- Palette index 0 is always transparent

### Sprite

A palette-indexed 2D pixel grid with generation metadata.

```
Sprite
├── id: string (UUID)
├── name: string (user-provided or auto-generated)
├── width: integer (1-512)
├── height: integer (1-512)
├── prompt: string (the text prompt used to generate this sprite)
├── parentId: string | null (sprite ID this was iterated from)
├── createdAt: ISO 8601 datetime
├── pixels: integer[][] (2D array of palette indices, height x width)
└── palette: Color[] (snapshot of project palette at generation time)
```

**Storage**: `data/projects/{project-id}/sprites/{id}.json`

**Validation**:
- Width and height must match pixels array dimensions
- All pixel values must be valid palette indices (0 to palette.length - 1)
- Out-of-range indices clamped to 0 on save
- Prompt must be non-empty

### Palette

An ordered list of colors. Not stored separately — embedded in project manifest and in each sprite.

```
Palette = Color[]

Color
├── r: integer (0-255)
├── g: integer (0-255)
└── b: integer (0-255)
```

**Rules**:
- Index 0 is always transparent (by convention, not enforced in color values)
- Max 256 entries
- 16 colors → 4-bit PICT export; 17-256 colors → 8-bit PICT export

## Relationships

```
Project 1──* Sprite       (a project contains many sprites)
Sprite  1──? Sprite       (a sprite may have a parent via parentId)
Project 1──1 Palette      (each project has one palette)
Sprite  1──1 Palette      (each sprite snapshots the palette at creation)
```

## File System Layout

```
data/
└── projects/
    ├── a1b2c3d4/
    │   ├── manifest.json        # { id, name, createdAt, palette }
    │   └── sprites/
    │       ├── e5f6g7h8.json    # { id, name, width, height, prompt, parentId, createdAt, pixels, palette }
    │       └── i9j0k1l2.json
    └── m3n4o5p6/
        ├── manifest.json
        └── sprites/
```

## State Transitions

Sprites have no complex lifecycle — they are created and optionally deleted. No draft/published states.

```
[Generate] → Sprite exists in preview (unsaved, transient)
[Save]     → Sprite persisted to disk
[Delete]   → Sprite file removed
```
