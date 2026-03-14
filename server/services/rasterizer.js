'use strict';

/**
 * Drawing commands rasterizer.
 * Converts shape primitives into a 2D pixel grid of palette indices.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGrid(width, height) {
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid.push(new Array(width).fill(0));
  }
  return grid;
}

function clampColor(color, paletteLength) {
  if (typeof color !== 'number' || !Number.isFinite(color)) return 0;
  const c = Math.round(color);
  if (c < 0 || c >= paletteLength) return 0;
  return c;
}

function setPixel(grid, width, height, x, y, color) {
  if (x >= 0 && x < width && y >= 0 && y < height) {
    grid[y][x] = color;
  }
}

// ---------------------------------------------------------------------------
// Drawing primitives
// ---------------------------------------------------------------------------

function drawRect(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const x0 = Math.max(0, Math.floor(cmd.x));
  const y0 = Math.max(0, Math.floor(cmd.y));
  const x1 = Math.min(width, Math.floor(cmd.x + cmd.w));
  const y1 = Math.min(height, Math.floor(cmd.y + cmd.h));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      grid[y][x] = color;
    }
  }
}

function drawCircle(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const { cx, cy, r } = cmd;
  const x0 = Math.max(0, Math.floor(cx - r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const x1 = Math.min(width - 1, Math.floor(cx + r));
  const y1 = Math.min(height - 1, Math.floor(cy + r));
  const r2 = r * r;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) {
        grid[y][x] = color;
      }
    }
  }
}

function drawEllipse(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const { cx, cy, rx, ry } = cmd;
  const x0 = Math.max(0, Math.floor(cx - rx));
  const y0 = Math.max(0, Math.floor(cy - ry));
  const x1 = Math.min(width - 1, Math.floor(cx + rx));
  const y1 = Math.min(height - 1, Math.floor(cy + ry));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        grid[y][x] = color;
      }
    }
  }
}

function drawLine(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const thickness = (typeof cmd.thickness === 'number' && cmd.thickness >= 1)
    ? Math.round(cmd.thickness)
    : 1;

  // Bresenham's line algorithm to collect all points along the line
  let x0 = Math.round(cmd.x1);
  let y0 = Math.round(cmd.y1);
  const x1 = Math.round(cmd.x2);
  const y1 = Math.round(cmd.y2);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (thickness <= 1) {
      setPixel(grid, width, height, x0, y0, color);
    } else {
      // Draw filled circle at each point for thick lines
      const r = (thickness - 1) / 2;
      const r2 = r * r;
      const minX = Math.max(0, Math.floor(x0 - r));
      const minY = Math.max(0, Math.floor(y0 - r));
      const maxX = Math.min(width - 1, Math.floor(x0 + r));
      const maxY = Math.min(height - 1, Math.floor(y0 + r));
      for (let py = minY; py <= maxY; py++) {
        for (let px = minX; px <= maxX; px++) {
          const ddx = px - x0;
          const ddy = py - y0;
          if (ddx * ddx + ddy * ddy <= r2) {
            grid[py][px] = color;
          }
        }
      }
    }

    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
}

function drawPolygon(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const points = cmd.points;
  if (!Array.isArray(points) || points.length < 3) return;

  // Find bounding box
  let minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.floor(maxY));

  // Scanline fill
  for (let y = minY; y <= maxY; y++) {
    const intersections = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const yi = points[i].y;
      const yj = points[j].y;
      if ((yi <= y && yj > y) || (yj <= y && yi > y)) {
        const xi = points[i].x;
        const xj = points[j].x;
        const t = (y - yi) / (yj - yi);
        intersections.push(xi + t * (xj - xi));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.ceil(intersections[i]));
      const xEnd = Math.min(width - 1, Math.floor(intersections[i + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        grid[y][x] = color;
      }
    }
  }
}

function drawFill(grid, width, height, cmd, paletteLength) {
  const color = clampColor(cmd.color, paletteLength);
  const startX = Math.round(cmd.x);
  const startY = Math.round(cmd.y);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const targetColor = grid[startY][startX];
  if (targetColor === color) return;

  // Iterative flood fill using a stack
  const stack = [[startX, startY]];
  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (grid[y][x] !== targetColor) continue;

    grid[y][x] = color;
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = {
  rect: ['x', 'y', 'w', 'h', 'color'],
  circle: ['cx', 'cy', 'r', 'color'],
  ellipse: ['cx', 'cy', 'rx', 'ry', 'color'],
  line: ['x1', 'y1', 'x2', 'y2', 'color'],
  polygon: ['points', 'color'],
  fill: ['x', 'y', 'color'],
};

function validateCommand(cmd, index) {
  if (cmd == null || typeof cmd !== 'object') {
    return { index, type: 'unknown', message: 'Command is not an object' };
  }
  const type = cmd.type;
  if (typeof type !== 'string' || !(type in REQUIRED_FIELDS)) {
    return { index, type: type || 'unknown', message: `Unknown command type: ${type}` };
  }
  const required = REQUIRED_FIELDS[type];
  const missing = required.filter(f => cmd[f] === undefined || cmd[f] === null);
  if (missing.length > 0) {
    return { index, type, message: `Missing required fields: ${missing.join(', ')}` };
  }
  // Numeric field validation (all required fields except 'points' must be numbers)
  for (const f of required) {
    if (f === 'points') continue;
    if (typeof cmd[f] !== 'number' || !Number.isFinite(cmd[f])) {
      return { index, type, message: `Field "${f}" must be a finite number` };
    }
  }
  // Polygon-specific: points must be an array of {x, y} with at least 3 entries
  if (type === 'polygon') {
    if (!Array.isArray(cmd.points) || cmd.points.length < 3) {
      return { index, type, message: 'Polygon requires at least 3 points' };
    }
    for (let i = 0; i < cmd.points.length; i++) {
      const p = cmd.points[i];
      if (p == null || typeof p.x !== 'number' || typeof p.y !== 'number') {
        return { index, type, message: `Invalid point at index ${i}` };
      }
    }
  }
  return null; // valid
}

// ---------------------------------------------------------------------------
// Dispatch table
// ---------------------------------------------------------------------------

const DRAW_FNS = {
  rect: drawRect,
  circle: drawCircle,
  ellipse: drawEllipse,
  line: drawLine,
  polygon: drawPolygon,
  fill: drawFill,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Rasterize an array of drawing commands into a 2D pixel grid.
 *
 * @param {number} width   Grid width in pixels
 * @param {number} height  Grid height in pixels
 * @param {Array}  commands Array of DrawingCommand objects
 * @param {number} paletteLength Number of colors in the palette
 * @returns {{ pixels: number[][], warnings: Array<{index: number, type: string, message: string}> }}
 */
function rasterize(width, height, commands, paletteLength) {
  const grid = createGrid(width, height);
  const warnings = [];

  if (!Array.isArray(commands)) {
    return { pixels: grid, warnings };
  }

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const warning = validateCommand(cmd, i);
    if (warning) {
      warnings.push(warning);
      continue;
    }
    DRAW_FNS[cmd.type](grid, width, height, cmd, paletteLength);
  }

  return { pixels: grid, warnings };
}

module.exports = { rasterize };
