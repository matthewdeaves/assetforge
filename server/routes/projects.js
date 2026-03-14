const express = require('express');
const router = express.Router();
const projects = require('../services/projects');

const DEFAULT_PALETTE = [
  {r:0,g:0,b:0}, {r:34,g:34,b:34}, {r:68,g:68,b:68}, {r:119,g:119,b:119},
  {r:170,g:170,b:170}, {r:255,g:255,b:255}, {r:204,g:51,b:51}, {r:204,g:119,b:34},
  {r:204,g:204,b:51}, {r:51,g:170,b:51}, {r:51,g:170,b:170}, {r:51,g:102,b:204},
  {r:119,g:51,b:204}, {r:204,g:51,b:170}, {r:139,g:119,b:101}, {r:194,g:178,b:128}
];

// GET /api/projects — list all projects
router.get('/projects', async (req, res) => {
  try {
    const list = await projects.listProjects();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects — create project
router.post('/projects', async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'name must be 100 characters or fewer' });
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({ error: 'description is required and must be a non-empty string' });
    }

    let palette = DEFAULT_PALETTE;
    try {
      const llm = require('../services/llm');
      palette = await llm.generatePalette(description);
    } catch {
      // LLM failed, use default palette
    }

    const project = await projects.createProject(name.trim(), description.trim(), palette);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — get single project
router.get('/projects/:id', async (req, res) => {
  try {
    const project = await projects.getProject(req.params.id);
    res.json(project);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id — delete project
router.delete('/projects/:id', async (req, res) => {
  try {
    await projects.deleteProject(req.params.id);
    res.status(204).send();
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id/palette — update palette
router.put('/projects/:id/palette', async (req, res) => {
  try {
    const { palette } = req.body;

    if (!Array.isArray(palette)) {
      return res.status(400).json({ error: 'palette must be an array' });
    }
    if (palette.length < 2 || palette.length > 256) {
      return res.status(400).json({ error: 'palette must have between 2 and 256 entries' });
    }
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      if (typeof c !== 'object' || c === null ||
          typeof c.r !== 'number' || typeof c.g !== 'number' || typeof c.b !== 'number') {
        return res.status(400).json({ error: `palette[${i}] must be an object with numeric r, g, b properties` });
      }
    }

    const updated = await projects.updatePalette(req.params.id, palette);
    res.json(updated);
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/palette/generate — generate palette from prompt
router.post('/projects/:id/palette/generate', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
    }

    // Verify project exists
    await projects.getProject(req.params.id);

    const llm = require('../services/llm');
    const palette = await llm.generatePalette(prompt.trim());
    res.json({ palette });
  } catch (err) {
    if (err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
