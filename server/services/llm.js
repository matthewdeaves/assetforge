const fs = require('fs');
const path = require('path');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

function getApiKey() {
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  const dockerPath = '/app/openrouterkey';
  if (fs.existsSync(dockerPath)) {
    return fs.readFileSync(dockerPath, 'utf-8').trim();
  }

  const localPath = path.resolve('./openrouterkey');
  if (fs.existsSync(localPath)) {
    return fs.readFileSync(localPath, 'utf-8').trim();
  }

  throw new Error(
    'OpenRouter API key not found. Set OPENROUTER_API_KEY env var, ' +
    'or mount a key file at /app/openrouterkey (Docker) or ./openrouterkey (dev).'
  );
}

function getModel() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

/**
 * Extract JSON from LLM response text.
 * Tries direct parse, then code blocks, then bare JSON patterns.
 */
function extractJSON(text) {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch (_) {
    // continue
  }

  // Look for ```json ... ``` code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {
      // continue
    }
  }

  // Look for JSON array pattern [ ... ]
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]);
    } catch (_) {
      // continue
    }
  }

  // Look for JSON object pattern { ... }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (_) {
      // continue
    }
  }

  throw new Error('Could not extract JSON from LLM response:\n' + text.slice(0, 500));
}

async function callOpenRouter(systemPrompt, userMessage, modelOverride) {
  const apiKey = getApiKey();
  const model = modelOverride || getModel();

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error('OpenRouter API key is invalid or missing. Check your openrouterkey file.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited by OpenRouter. Please wait a moment and try again.');
    }
    if (response.status >= 500) {
      throw new Error('OpenRouter service is temporarily unavailable. Please try again shortly.');
    }
    throw new Error(`OpenRouter API error (${response.status}): ${body}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices.length) {
    throw new Error('The LLM returned an empty response. Please try again with a different prompt.');
  }

  return data.choices[0].message.content;
}

function buildPaletteDescription(palette) {
  return palette
    .map((c, i) => {
      if (i === 0) return `  ${i}: rgb(${c.r}, ${c.g}, ${c.b}) — transparent`;
      return `  ${i}: rgb(${c.r}, ${c.g}, ${c.b})`;
    })
    .join('\n');
}

const COMMAND_SCHEMA_DOCS = `Available drawing command types (JSON objects):

- rect: { "type": "rect", "x": int, "y": int, "w": int, "h": int, "color": int }
  Filled rectangle. x,y is top-left corner, w is width, h is height.

- circle: { "type": "circle", "cx": int, "cy": int, "r": int, "color": int }
  Filled circle. cx,cy is center, r is radius.

- ellipse: { "type": "ellipse", "cx": int, "cy": int, "rx": int, "ry": int, "color": int }
  Filled ellipse. cx,cy is center, rx/ry are x/y radii.

- line: { "type": "line", "x1": int, "y1": int, "x2": int, "y2": int, "color": int, "thickness": int }
  Line between two points. thickness defaults to 1.

- polygon: { "type": "polygon", "points": [{"x": int, "y": int}, ...], "color": int }
  Filled polygon. Minimum 3 points.

- fill: { "type": "fill", "x": int, "y": int, "color": int }
  Flood fill from the given point.`;

/**
 * Generate sprite drawing commands via the LLM.
 *
 * @param {string} prompt - User's text description of the sprite
 * @param {Array|null} palette - Array of {r, g, b} color objects, or null for free-color mode
 * @param {number} width - Grid width in pixels
 * @param {number} height - Grid height in pixels
 * @param {Array|null} existingCommands - Existing drawing commands to iterate on
 * @returns {{ commands: object[], palette?: object[] }}
 */
async function generateSprite(prompt, palette, width, height, existingCommands = null) {
  const isFreeColor = palette === null || palette === undefined;

  let systemParts = [
    'You are an expert pixel art sprite generator for retro games. You produce drawing commands as a JSON array that will be rasterized onto a pixel grid.',
    '',
    COMMAND_SCHEMA_DOCS,
    '',
    `Grid dimensions: ${width}x${height} pixels.`,
    'Coordinates start at (0,0) in the top-left corner.',
    'Commands execute in order — later commands draw over earlier ones (painter\'s algorithm). This is KEY to creating quality sprites: build up layers from background to foreground, using overlapping shapes to create shading, depth, and detail.',
    '',
    'HOW TO MAKE GREAT SPRITES:',
    '- Break the subject into 3-5 distinct parts. Give each part its OWN color family so parts never blend together.',
    '- Do NOT draw a black outline around the whole sprite. Parts define their own edges by contrasting with neighbors.',
    '- Shade each part with 3+ layers: dark base rect first, then lighter/smaller rects on top for highlights.',
    '- Add internal texture: repeating small rects for patterns (segments, grooves, scales, bricks, fur, etc).',
    '- Add tiny details last: 2x2 or 3x3 rects for rivets, dots, eyes, bolts, markings.',
    '- Use 40-80 commands. More = better detail.',
    '- Fill most of the grid. Index 0 (transparent) only at the edges of the silhouette.',
    '',
    'EXAMPLE: a 32x32 wooden crate (palette: 0=transparent, 1=dark brown, 2=medium brown, 3=light brown, 4=tan, 5=dark gray, 6=gray):',
    '[',
    '  {"type":"rect","x":2,"y":2,"w":28,"h":28,"color":1},',
    '  {"type":"rect","x":3,"y":3,"w":26,"h":26,"color":2},',
    '  {"type":"rect","x":4,"y":4,"w":24,"h":24,"color":3},',
    '  {"type":"rect","x":2,"y":15,"w":28,"h":2,"color":1},',
    '  {"type":"rect","x":15,"y":2,"w":2,"h":28,"color":1},',
    '  {"type":"rect","x":5,"y":5,"w":9,"h":9,"color":4},',
    '  {"type":"rect","x":18,"y":5,"w":9,"h":9,"color":4},',
    '  {"type":"rect","x":5,"y":18,"w":9,"h":9,"color":4},',
    '  {"type":"rect","x":18,"y":18,"w":9,"h":9,"color":4},',
    '  {"type":"rect","x":2,"y":2,"w":2,"h":2,"color":5},',
    '  {"type":"rect","x":28,"y":2,"w":2,"h":2,"color":5},',
    '  {"type":"rect","x":2,"y":28,"w":2,"h":2,"color":5},',
    '  {"type":"rect","x":28,"y":28,"w":2,"h":2,"color":5},',
    '  {"type":"rect","x":3,"y":3,"w":1,"h":1,"color":6},',
    '  {"type":"rect","x":29,"y":3,"w":1,"h":1,"color":6},',
    '  {"type":"rect","x":3,"y":29,"w":1,"h":1,"color":6},',
    '  {"type":"rect","x":29,"y":29,"w":1,"h":1,"color":6}',
    ']',
    'This crate works because: dark frame → medium fill → light panels, cross-beams break it into 4 sections, corner brackets add detail. Apply the same layered approach to ANY subject.',
    '',
  ];

  if (isFreeColor) {
    systemParts.push(
      'No palette is provided. You must define your own palette.',
      'The "color" field in commands refers to a palette index (integer).',
      'Index 0 is always transparent.',
      '',
      'Return a JSON object with two fields:',
      '  { "commands": [ ...drawing commands... ], "palette": [ ...colors... ] }',
      'The palette is an array of {r, g, b} objects (0-255). Index 0 should be black (it represents transparent).',
      'Choose colors that work well together for the described sprite.',
      '',
      'Return ONLY the JSON object. No explanation.'
    );
  } else {
    systemParts.push(
      'Available palette colors (use the index as the "color" field value):',
      buildPaletteDescription(palette),
      '',
      'Return ONLY a JSON array of drawing commands. No explanation, no wrapping object.'
    );
  }

  if (existingCommands) {
    systemParts.push(
      '',
      'Here are the existing sprite drawing commands to modify or extend:',
      JSON.stringify(existingCommands, null, 2),
      '',
      'Modify, extend, or refine these commands based on the user\'s request.',
      'Return the complete updated list of commands (not just the changes).'
    );
  }

  const systemPrompt = systemParts.join('\n');
  const responseText = await callOpenRouter(systemPrompt, prompt);
  const parsed = extractJSON(responseText);

  if (isFreeColor) {
    // Expect { commands: [...], palette: [...] }
    if (Array.isArray(parsed)) {
      // LLM returned just an array — treat as commands, no palette
      return { commands: parsed };
    }
    return {
      commands: parsed.commands || [],
      palette: parsed.palette || undefined,
    };
  }

  // Palette mode — expect a bare array of commands
  const commands = Array.isArray(parsed) ? parsed : (parsed.commands || []);
  return { commands };
}

/**
 * Generate a 16-color palette via the LLM.
 *
 * @param {string} prompt - Description of the palette theme
 * @returns {Array<{r: number, g: number, b: number}>}
 */
async function generatePalette(prompt) {
  const systemPrompt =
    'Generate a 16-color palette for pixel art. ' +
    'Index 0 is always transparent (black). ' +
    'Return a JSON array of objects with r, g, b fields (0-255). ' +
    'The palette should be cohesive and suitable for the described theme. ' +
    'Return ONLY the JSON array. No explanation.';

  const responseText = await callOpenRouter(systemPrompt, prompt);
  const parsed = extractJSON(responseText);

  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array for palette, got: ' + typeof parsed);
  }

  return parsed.map(c => ({
    r: Math.max(0, Math.min(255, Math.round(c.r))),
    g: Math.max(0, Math.min(255, Math.round(c.g))),
    b: Math.max(0, Math.min(255, Math.round(c.b))),
  }));
}

module.exports = { generateSprite, generatePalette, extractJSON, callOpenRouter };
