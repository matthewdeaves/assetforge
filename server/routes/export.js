const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const projectsService = require('../services/projects');
const exportService = require('../services/export');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

function spritesDir(projectId) {
  return path.join(DATA_DIR, projectId, 'sprites');
}

function spriteFile(projectId, spriteId) {
  return path.join(spritesDir(projectId), `${spriteId}.json`);
}

// GET /api/projects/:projectId/sprites/:spriteId/export
router.get('/projects/:projectId/sprites/:spriteId/export', async (req, res) => {
  try {
    const { projectId, spriteId } = req.params;

    // Load project (validates it exists)
    try {
      await projectsService.getProject(projectId);
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
      }
      throw err;
    }

    // Load full sprite data
    let sprite;
    try {
      const raw = await fs.readFile(spriteFile(projectId, spriteId), 'utf-8');
      sprite = JSON.parse(raw);
    } catch {
      return res.status(404).json({ error: `Sprite not found: ${spriteId}` });
    }

    const buffer = exportService.exportSprite(sprite);
    const filename = exportService.sanitizeFilename(sprite.name) + '.bin';

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:projectId/export
router.get('/projects/:projectId/export', async (req, res) => {
  try {
    const { projectId } = req.params;

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

    // Load all sprites (full data)
    const dir = spritesDir(projectId);
    let files;
    try {
      files = await fs.readdir(dir);
    } catch {
      return res.status(400).json({ error: 'No sprites found in project' });
    }

    const sprites = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(dir, file), 'utf-8');
        sprites.push(JSON.parse(raw));
      } catch {
        // skip invalid sprite files
      }
    }

    if (sprites.length === 0) {
      return res.status(400).json({ error: 'No sprites found in project' });
    }

    const buffer = exportService.exportProject(project, sprites);
    const filename = exportService.sanitizeFilename(project.name) + '.dsk';

    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
