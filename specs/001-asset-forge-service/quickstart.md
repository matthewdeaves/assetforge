# Quickstart: Asset Forge Service

## Prerequisites

- Docker and docker-compose
- An OpenRouter API key (get one at https://openrouter.ai)

## Run

```bash
# Set your API key
export OPENROUTER_API_KEY=sk-or-...

# Start the service
docker compose up

# Open in browser
open http://localhost:3777
```

## First Use

1. Open http://localhost:3777
2. Create a project (e.g., "Tank Game")
3. Enter a prompt: "draw a top-down yellow tank with a big gun"
4. Set grid size: 64x64
5. Click Generate — see the sprite in the grid preview
6. Adjust zoom, toggle grid overlay
7. Click Save
8. To iterate: select the sprite → "Create variation" → "make it blue"
9. To export: select sprite → Export → downloads a .bin file
10. Transfer .bin to a classic Mac — double-click opens as PICT

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

- `server/` — Node.js backend (Express)
- `public/` — Static frontend (HTML/CSS/JS)
- `tools/` — C export tools (grid2pict, pict2macbin)
- `data/` — Runtime project storage (Docker volume)
- `archive/` — Legacy HTML reference files
