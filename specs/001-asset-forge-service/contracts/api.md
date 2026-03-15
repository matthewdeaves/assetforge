# API Contracts: Asset Forge Service

## Base URL

`http://localhost:3777/api`

## Projects

### List Projects

```
GET /projects

Response 200:
[
  {
    "id": "a1b2c3d4",
    "name": "Tank Game",
    "createdAt": "2026-03-14T12:00:00Z",
    "spriteCount": 5
  }
]
```

### Create Project

```
POST /projects
Content-Type: application/json

{
  "name": "Tank Game",
  "description": "a top-down tank battle game with desert and jungle maps"
}

Response 201:
{
  "id": "a1b2c3d4",
  "name": "Tank Game",
  "description": "a top-down tank battle game with desert and jungle maps",
  "createdAt": "2026-03-14T12:00:00Z",
  "palette": [ { "r": 0, "g": 0, "b": 0 }, ... ]
}

Note: The LLM generates an initial 16-color palette from the project description.
```

### Get Project

```
GET /projects/:id

Response 200:
{
  "id": "a1b2c3d4",
  "name": "Tank Game",
  "description": "a top-down tank battle game with desert and jungle maps",
  "createdAt": "2026-03-14T12:00:00Z",
  "palette": [ ... ]
}
```

### Delete Project

```
DELETE /projects/:id

Response 204 (no body)
```

### Generate Palette

```
POST /projects/:id/palette/generate
Content-Type: application/json

{
  "prompt": "military desert colors"
}

Response 200:
{
  "palette": [
    { "r": 0, "g": 0, "b": 0 },
    { "r": 194, "g": 178, "b": 128 },
    ...
  ]
}
```

Note: Returns generated palette for preview. Call Update Palette to persist.

### Update Palette

```
PUT /projects/:id/palette
Content-Type: application/json

{
  "palette": [
    { "r": 0, "g": 0, "b": 0 },
    { "r": 194, "g": 178, "b": 128 },
    ...
  ]
}

Response 200:
{
  "palette": [ ... ]
}
```

## Sprites

### List Sprites in Project

```
GET /projects/:projectId/sprites

Response 200:
[
  {
    "id": "e5f6g7h8",
    "name": "Yellow Tank",
    "width": 64,
    "height": 64,
    "prompt": "draw a top-down yellow tank with a big gun",
    "parentId": null,
    "createdAt": "2026-03-14T12:05:00Z"
  }
]
```

Note: Neither pixel data nor drawing commands are included in list responses (too large). Use Get Sprite for full data.

### Get Sprite

```
GET /projects/:projectId/sprites/:spriteId

Response 200:
{
  "id": "e5f6g7h8",
  "name": "Yellow Tank",
  "width": 64,
  "height": 64,
  "prompt": "draw a top-down yellow tank with a big gun",
  "parentId": null,
  "createdAt": "2026-03-14T12:05:00Z",
  "commands": [
    { "type": "rect", "x": 2, "y": 8, "w": 18, "h": 54, "color": 13 },
    { "type": "circle", "cx": 32, "cy": 32, "r": 12, "color": 5 },
    ...
  ],
  "pixels": [[0, 0, 1, ...], ...],
  "palette": [{ "r": 0, "g": 0, "b": 0 }, ...]
}
```

### Generate Sprite

```
POST /projects/:projectId/sprites/generate
Content-Type: application/json

{
  "prompt": "draw a top-down yellow tank with a big gun",
  "width": 64,
  "height": 64,
  "parentId": null,
  "useProjectPalette": true
}

Response 200:
{
  "commands": [
    { "type": "rect", "x": 2, "y": 8, "w": 18, "h": 54, "color": 13 },
    { "type": "circle", "cx": 32, "cy": 32, "r": 12, "color": 5 },
    ...
  ],
  "pixels": [[0, 0, 1, ...], ...],
  "width": 64,
  "height": 64,
  "prompt": "draw a top-down yellow tank with a big gun",
  "parentId": null,
  "palette": [{ "r": 0, "g": 0, "b": 0 }, ...]
}
```

Note: The LLM returns drawing commands. The server rasterizes them into the pixels array. This returns the generated sprite data for preview but does NOT save it. The client must call Save Sprite to persist.

If `parentId` is provided, the parent sprite's drawing commands are included in the LLM prompt as context for iteration.

If `useProjectPalette` is false (default true), the LLM chooses colors freely and the response includes the LLM-chosen palette. The sprite stores this palette independently of the project palette.

### Save Sprite

```
POST /projects/:projectId/sprites
Content-Type: application/json

{
  "name": "Yellow Tank",
  "width": 64,
  "height": 64,
  "prompt": "draw a top-down yellow tank with a big gun",
  "parentId": null,
  "commands": [...],
  "pixels": [[0, 0, 1, ...], ...],
  "palette": [{ "r": 0, "g": 0, "b": 0 }, ...]
}

Note: `palette` is optional. If omitted, the project's current palette is snapshotted. Required when saving a free-color sprite (useProjectPalette was false during generation).

Response 201:
{
  "id": "e5f6g7h8",
  "name": "Yellow Tank",
  "width": 64,
  "height": 64,
  "prompt": "draw a top-down yellow tank with a big gun",
  "parentId": null,
  "createdAt": "2026-03-14T12:05:00Z"
}
```

### Delete Sprite

```
DELETE /projects/:projectId/sprites/:spriteId

Response 204 (no body)
```

## Export

### Export Sprite as PICT

```
GET /projects/:projectId/sprites/:spriteId/export

Response 200:
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="YellowTank.bin"

(MacBinary file body)
```

The server writes sprite JSON (pixels + palette) to a temp file, shells out to `grid2pict` (JSON → PICT 2.0), then `pict2macbin` (PICT → MacBinary with type `PICT` / creator `ttxt`), streams the result, and cleans up temp files.

### Export All Sprites as HFS Disk Image

```
GET /projects/:projectId/export

Response 200:
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="TankGame.dsk"

(HFS disk image body)
```

The server converts all sprites in the project to PICT 2.0 via `grid2pict`, then packages them into an HFS disk image via `picts2dsk`. The disk image contains a folder named after the project, with all sprites as native PICT files (type `PICT`, creator `ttxt` set via HFS file info — no MacBinary wrapping). The .dsk file is streamed as a download.

## Error Responses

All errors return:

```
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|--------|---------|
| 400 | Bad request (missing fields, invalid dimensions) |
| 404 | Project or sprite not found |
| 500 | Server error (LLM failure, rasterization failure, export failure) |
| 502 | OpenRouter API unavailable |
