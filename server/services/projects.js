const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data', 'projects');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function listProjects() {
  try {
    await ensureDataDir();
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const manifestPath = path.join(DATA_DIR, entry.name, 'manifest.json');
        const raw = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(raw);

        let spriteCount = 0;
        try {
          const spritesDir = path.join(DATA_DIR, entry.name, 'sprites');
          const spriteFiles = await fs.readdir(spritesDir);
          spriteCount = spriteFiles.length;
        } catch {
          // sprites dir may not exist
        }

        projects.push({
          id: manifest.id,
          name: manifest.name,
          createdAt: manifest.createdAt,
          spriteCount
        });
      } catch {
        // skip directories without valid manifest
      }
    }

    return projects;
  } catch {
    return [];
  }
}

async function createProject(name, description, palette) {
  await ensureDataDir();

  const id = crypto.randomUUID();
  const projectDir = path.join(DATA_DIR, id);
  const spritesDir = path.join(projectDir, 'sprites');

  await fs.mkdir(spritesDir, { recursive: true });

  const manifest = {
    id,
    name,
    description,
    createdAt: new Date().toISOString(),
    palette
  };

  await fs.writeFile(
    path.join(projectDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );

  return manifest;
}

async function getProject(id) {
  const manifestPath = path.join(DATA_DIR, id, 'manifest.json');
  try {
    const raw = await fs.readFile(manifestPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    const error = new Error(`Project not found: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }
}

async function deleteProject(id) {
  const projectDir = path.join(DATA_DIR, id);
  try {
    await fs.access(projectDir);
  } catch {
    const error = new Error(`Project not found: ${id}`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  await fs.rm(projectDir, { recursive: true });
}

async function updatePalette(id, palette) {
  const manifest = await getProject(id);
  manifest.palette = palette;

  const manifestPath = path.join(DATA_DIR, id, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  return manifest;
}

module.exports = { listProjects, createProject, getProject, deleteProject, updatePalette };
