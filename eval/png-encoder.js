'use strict';

const path = require('path');
const { PNG } = require(path.join(__dirname, '..', 'server', 'node_modules', 'pngjs'));

/**
 * Render a pixel array + palette to a scaled PNG buffer.
 *
 * @param {number[][]} pixels - 2D array of palette indices
 * @param {{r:number,g:number,b:number}[]} palette - Palette colours (index 0 = transparent)
 * @param {number} [scale=4] - Scale factor (each logical pixel becomes scale×scale real pixels)
 * @returns {Buffer} PNG file data
 */
function renderToPNG(pixels, palette, scale = 4) {
  const h = pixels.length;
  const w = pixels[0].length;
  const png = new PNG({ width: w * scale, height: h * scale });

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = pixels[y][x];
      const color = palette[idx];
      const r = color ? color.r : 0;
      const g = color ? color.g : 0;
      const b = color ? color.b : 0;
      const a = idx === 0 ? 0 : 255; // index 0 = transparent

      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = (x * scale + sx);
          const py = (y * scale + sy);
          const offset = (py * png.width + px) * 4;
          png.data[offset] = r;
          png.data[offset + 1] = g;
          png.data[offset + 2] = b;
          png.data[offset + 3] = a;
        }
      }
    }
  }

  return PNG.sync.write(png);
}

module.exports = { renderToPNG };
