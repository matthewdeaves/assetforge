const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { rasterize } = require('../services/rasterizer');
const { generateSprite: llmGenerateSprite } = require('../services/llm');
const projectsService = require('../services/projects');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

function spritesDir(projectId) {
  return path.join(DATA_DIR, projectId, 'sprites');
}

function spriteFile(projectId, spriteId) {
  return path.join(spritesDir(projectId), `${spriteId}.json`);
}

// POST /api/projects/:projectId/sprites/generate
router.post('/projects/:projectId/sprites/generate', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { prompt, width, height, useProjectPalette = true, parentId } = req.body;

    // Validate inputs
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
    }
    if (!Number.isInteger(width) || width < 1 || width > 512) {
      return res.status(400).json({ error: 'width must be an integer between 1 and 512' });
    }
    if (!Number.isInteger(height) || height < 1 || height > 512) {
      return res.status(400).json({ error: 'height must be an integer between 1 and 512' });
    }

    // Load project
    let project;
    try {
      project = await projectsService.getProject(projectId);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }

    // If parentId provided, load parent sprite for existing commands
    let existingCommands = null;
    if (parentId) {
      try {
        const parentPath = spriteFile(projectId, parentId);
        const raw = await fs.readFile(parentPath, 'utf-8');
        const parentSprite = JSON.parse(raw);
        existingCommands = parentSprite.commands || null;
      } catch {
        return res.status(404).json({ error: `Parent sprite not found: ${parentId}` });
      }
    }

    // Determine palette
    const palette = useProjectPalette ? project.palette : null;

    // Call LLM
    let llmResult;
    try {
      llmResult = await llmGenerateSprite(prompt, palette, width, height, existingCommands);
    } catch (err) {
      const status = err.message.includes('OpenRouter API error') ? 502 : 500;
      return res.status(status).json({ error: `LLM error: ${err.message}` });
    }

    // Determine the palette for rasterization
    const rasterPalette = llmResult.palette || palette || [];
    const paletteLength = rasterPalette.length;

    // Rasterize
    let rasterResult;
    try {
      rasterResult = rasterize(width, height, llmResult.commands, paletteLength);
    } catch (err) {
      return res.status(500).json({ error: `Rasterization error: ${err.message}` });
    }

    res.json({
      commands: llmResult.commands,
      pixels: rasterResult.pixels,
      width,
      height,
      prompt,
      parentId: parentId || null,
      palette: rasterPalette,
      warnings: rasterResult.warnings,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:projectId/sprites (save sprite)
router.post('/projects/:projectId/sprites', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { name, width, height, prompt, parentId, commands, pixels, palette } = req.body;

    // Validate inputs
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
    }
    if (!Array.isArray(commands) || commands.length === 0) {
      return res.status(400).json({ error: 'commands is required and must be a non-empty array' });
    }

    // Load project (validates it exists)
    let project;
    try {
      project = await projectsService.getProject(projectId);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }

    // Determine palette: use provided or snapshot project's current palette
    const spritePalette = palette || project.palette;

    const spriteId = crypto.randomUUID();
    const now = new Date().toISOString();

    const spriteData = {
      id: spriteId,
      name,
      width,
      height,
      prompt,
      parentId: parentId || null,
      createdAt: now,
      commands,
      pixels,
      palette: spritePalette,
    };

    // Ensure sprites directory exists
    const dir = spritesDir(projectId);
    await fs.mkdir(dir, { recursive: true });

    // Write sprite file
    await fs.writeFile(
      spriteFile(projectId, spriteId),
      JSON.stringify(spriteData, null, 2),
      'utf-8'
    );

    // Return summary (no pixels/commands)
    res.status(201).json({
      id: spriteId,
      name,
      width,
      height,
      prompt,
      parentId: parentId || null,
      createdAt: now,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/sprites (list sprites)
router.get('/projects/:projectId/sprites', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate project exists
    try {
      await projectsService.getProject(projectId);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }

    const dir = spritesDir(projectId);
    let files;
    try {
      files = await fs.readdir(dir);
    } catch {
      // sprites directory may not exist yet
      return res.json([]);
    }

    const sprites = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        const sprite = JSON.parse(raw);
        sprites.push({
          id: sprite.id,
          name: sprite.name,
          width: sprite.width,
          height: sprite.height,
          prompt: sprite.prompt,
          parentId: sprite.parentId || null,
          createdAt: sprite.createdAt,
        });
      } catch {
        // skip invalid sprite files
      }
    }

    res.json(sprites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/sprites/:spriteId (get sprite)
router.get('/projects/:projectId/sprites/:spriteId', async (req, res) => {
  try {
    const { projectId, spriteId } = req.params;

    // Validate project exists
    try {
      await projectsService.getProject(projectId);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }

    const filePath = spriteFile(projectId, spriteId);
    let raw;
    try {
      raw = await fs.readFile(filePath, 'utf-8');
    } catch {
      return res.status(404).json({ error: `Sprite not found: ${spriteId}` });
    }

    res.json(JSON.parse(raw));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:projectId/sprites/:spriteId
router.delete('/projects/:projectId/sprites/:spriteId', async (req, res) => {
  try {
    const { projectId, spriteId } = req.params;

    const filePath = spriteFile(projectId, spriteId);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: `Sprite not found: ${spriteId}` });
    }

    await fs.unlink(filePath);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
