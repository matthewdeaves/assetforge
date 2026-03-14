const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 31);
}

function exportSprite(sprite) {
  const tmpDir = os.tmpdir();
  const prefix = `assetforge-${crypto.randomUUID()}`;
  const inputPath = path.join(tmpDir, `${prefix}-input.json`);
  const pictPath = path.join(tmpDir, `${prefix}-output.pict`);
  const binPath = path.join(tmpDir, `${prefix}-output.bin`);

  try {
    // Build input JSON in the format grid2pict expects
    const input = {
      width: sprite.width,
      height: sprite.height,
      palette: sprite.palette.map(c => ({ r: c.r, g: c.g, b: c.b })),
      pixels: sprite.pixels,
    };

    fs.writeFileSync(inputPath, JSON.stringify(input));

    // Convert grid JSON to PICT
    execFileSync('grid2pict', [inputPath, pictPath]);

    // Wrap PICT in MacBinary
    execFileSync('pict2macbin', [pictPath, binPath]);

    // Read and return the MacBinary file
    return fs.readFileSync(binPath);
  } finally {
    // Clean up temp files
    for (const f of [inputPath, pictPath, binPath]) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

function exportProject(project, sprites) {
  const tmpDir = os.tmpdir();
  const prefix = `assetforge-${crypto.randomUUID()}`;
  const tempFiles = [];
  const pictFiles = []; // { name, path } for picts2dsk args

  try {
    // Convert each sprite to PICT
    for (const sprite of sprites) {
      const safeName = sanitizeFilename(sprite.name);
      const inputPath = path.join(tmpDir, `${prefix}-${safeName}-input.json`);
      const pictPath = path.join(tmpDir, `${prefix}-${safeName}.pict`);
      tempFiles.push(inputPath, pictPath);

      const input = {
        width: sprite.width,
        height: sprite.height,
        palette: sprite.palette.map(c => ({ r: c.r, g: c.g, b: c.b })),
        pixels: sprite.pixels,
      };

      fs.writeFileSync(inputPath, JSON.stringify(input));
      execFileSync('grid2pict', [inputPath, pictPath]);

      pictFiles.push({ name: safeName, path: pictPath });
    }

    // Build disk image
    const dskPath = path.join(tmpDir, `${prefix}-output.dsk`);
    tempFiles.push(dskPath);

    const volumeName = project.name.slice(0, 27);
    const folderName = project.name;

    // picts2dsk <volume_name> <folder_name> <output.dsk> <name1:pict1> [name2:pict2] ...
    const args = [
      volumeName,
      folderName,
      dskPath,
      ...pictFiles.map(pf => `${pf.name}:${pf.path}`),
    ];

    execFileSync('picts2dsk', args);

    return fs.readFileSync(dskPath);
  } finally {
    for (const f of tempFiles) {
      try { fs.unlinkSync(f); } catch {}
    }
  }
}

module.exports = { exportSprite, exportProject, sanitizeFilename };
