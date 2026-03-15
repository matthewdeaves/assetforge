# Quickstart: Asset Forge Service

## Prerequisites

- Docker and docker-compose
- An OpenRouter API key (get one at https://openrouter.ai)

## Run

```bash
# Save your API key to a file (gitignored)
echo "sk-or-..." > openrouterkey

# Start the service
docker compose up

# Open in browser
open http://localhost:3777
```

## First Use

1. Open http://localhost:3777
2. Create a project (e.g., "Tank Game") with a description of the visual theme
3. The LLM generates an initial 16-color palette from your description
4. Enter a prompt: "draw a top-down yellow tank with a big gun"
5. Set grid size: 64x64
6. Click Generate — the LLM returns drawing commands, the server rasterizes them, and you see the sprite in the grid preview
7. Adjust zoom, toggle grid overlay to inspect pixels
8. Click Save
9. To iterate: select the sprite → "Create variation" → "make it blue"
10. To export single: select sprite → Export → downloads a .bin file
11. To export all: click "Export All" → downloads a .dsk disk image
12. Transfer .bin or .dsk to a classic Mac — files open natively as PICT

## Development

```bash
# Without Docker (for development)
cd server && npm install && npm start

# Compile export tools
cd tools && make

# Test PICT export manually
tools/grid2pict tools/test_sprite.json /tmp/test.pict
```

## Project Structure

- `server/` — Node.js backend (Express + rasterizer)
- `public/` — Static frontend (HTML/CSS/JS)
- `tools/` — C export tools (grid2pict, pict2macbin, picts2dsk)
- `data/` — Runtime project storage (Docker volume)
- `archive/` — Legacy HTML reference files (includes procedural sprite examples)
