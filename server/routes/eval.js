'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { DIMENSION_RUBRICS } = require(path.join(__dirname, '..', '..', 'eval', 'judge.js'));

const RESULTS_DIR = path.join(__dirname, '..', '..', 'eval', 'results');

// GET /api/rubrics — return current dimension rubrics
router.get('/rubrics', (req, res) => {
  res.json({ dimensions: DIMENSION_RUBRICS });
});

// GET /api/eval/reports — list all eval reports
router.get('/eval/reports', (req, res) => {
  if (!fs.existsSync(RESULTS_DIR)) {
    return res.json({ reports: [] });
  }

  const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
  const reports = [];

  for (const filename of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, filename), 'utf-8'));
      const hasHumanScores = Array.isArray(data.results) &&
        data.results.some(r => r.humanScores != null);
      const successCount = Array.isArray(data.results)
        ? data.results.filter(r => r.status === 'success').length
        : 0;

      reports.push({
        filename,
        systemPromptVersion: data.systemPromptVersion || '',
        timestamp: data.timestamp || '',
        promptSetName: data.promptSetName || '',
        totalPrompts: Array.isArray(data.results) ? data.results.length : 0,
        successCount,
        hasHumanScores,
      });
    } catch {
      // Skip malformed files
    }
  }

  reports.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  res.json({ reports });
});

// GET /api/eval/reports/:filename — get a specific report
router.get('/eval/reports/:filename', (req, res) => {
  const { filename } = req.params;

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read report' });
  }
});

// POST /api/eval/reports/:filename/human-scores — save human scores
router.post('/eval/reports/:filename/human-scores', (req, res) => {
  const { filename } = req.params;

  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(RESULTS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Report not found' });
  }

  const { scores } = req.body;
  if (!Array.isArray(scores)) {
    return res.status(400).json({ error: 'scores must be an array' });
  }

  const dimensions = ['componentSeparation', 'colorUsage', 'detailDensity', 'spatialCoverage', 'promptAdherence'];

  for (const entry of scores) {
    if (typeof entry.index !== 'number') {
      return res.status(400).json({ error: 'Each score entry must have a numeric index' });
    }
    if (!entry.humanScores || typeof entry.humanScores !== 'object') {
      return res.status(400).json({ error: 'Each score entry must have a humanScores object' });
    }
    for (const dim of dimensions) {
      const val = entry.humanScores[dim];
      if (!Number.isInteger(val) || val < 1 || val > 5) {
        return res.status(400).json({ error: `Invalid scores: ${dim} must be 1-5` });
      }
    }
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    for (const entry of scores) {
      if (entry.index >= 0 && entry.index < data.results.length) {
        data.results[entry.index].humanScores = entry.humanScores;
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json({ saved: scores.length, total: data.results.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save scores' });
  }
});

module.exports = router;
