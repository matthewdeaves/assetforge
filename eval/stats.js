'use strict';

/**
 * Pixel statistics calculator for sprite evaluation.
 * Computes coverage, color usage, and command distribution metrics.
 */

/**
 * Compute statistics from rasterized pixel data and drawing commands.
 *
 * @param {number[][]} pixels - 2D grid of palette indices
 * @param {Array} palette - Array of {r, g, b} color objects
 * @param {Array} commands - Array of drawing command objects
 * @returns {object} Statistics object
 */
function computeStats(pixels, palette, commands) {
  const height = pixels.length;
  const width = height > 0 ? pixels[0].length : 0;
  const totalPixels = width * height;

  let filledPixels = 0;
  const colorSet = new Set();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y][x];
      if (idx !== 0) {
        filledPixels++;
      }
      colorSet.add(idx);
    }
  }

  // Remove index 0 (transparent) from unique color count
  colorSet.delete(0);
  const uniqueColors = colorSet.size;
  const paletteSize = palette ? palette.length : 0;

  const commandsByType = {};
  if (Array.isArray(commands)) {
    for (const cmd of commands) {
      if (cmd && cmd.type) {
        commandsByType[cmd.type] = (commandsByType[cmd.type] || 0) + 1;
      }
    }
  }

  const commandCount = Array.isArray(commands) ? commands.length : 0;

  return {
    totalPixels,
    filledPixels,
    coveragePercent: totalPixels > 0 ? (filledPixels / totalPixels) * 100 : 0,
    uniqueColors,
    paletteSize,
    paletteUtilization: paletteSize > 0 ? (uniqueColors / paletteSize) * 100 : 0,
    commandCount,
    commandsByType,
  };
}

module.exports = { computeStats };
