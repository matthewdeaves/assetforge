'use strict';

/**
 * Deliberately minimal system prompt — the "known-bad" baseline.
 * Gives the LLM only basic instructions with no quality guidelines.
 * Used to validate that the judge produces meaningfully different scores
 * compared to the full "current" prompt.
 */

const COMMAND_SCHEMA_DOCS = `Drawing commands:
- rect: { "type": "rect", "x": int, "y": int, "w": int, "h": int, "color": int }
- circle: { "type": "circle", "cx": int, "cy": int, "r": int, "color": int }
- ellipse: { "type": "ellipse", "cx": int, "cy": int, "rx": int, "ry": int, "color": int }
- line: { "type": "line", "x1": int, "y1": int, "x2": int, "y2": int, "color": int, "thickness": int }
- polygon: { "type": "polygon", "points": [{"x": int, "y": int}, ...], "color": int }
- fill: { "type": "fill", "x": int, "y": int, "color": int }`;

/**
 * Build a minimal system prompt with no quality guidance.
 *
 * @param {number} width - Grid width in pixels
 * @param {number} height - Grid height in pixels
 * @returns {string} System prompt string
 */
function buildSystemPrompt(width, height) {
  return [
    'You generate pixel art sprites as JSON drawing commands.',
    '',
    COMMAND_SCHEMA_DOCS,
    '',
    `Grid: ${width}x${height} pixels. Coordinates start at (0,0) top-left.`,
    'Color field is a palette index. Index 0 is transparent.',
  ].join('\n');
}

module.exports = { buildSystemPrompt };
