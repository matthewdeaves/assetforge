'use strict';

const path = require('path');
const { callOpenRouter, extractJSON } = require(path.join(__dirname, '..', 'server', 'services', 'llm.js'));

// ---------------------------------------------------------------------------
// Per-dimension rubrics with explicit score-level anchors (1-5 Likert scale)
// ---------------------------------------------------------------------------

const DIMENSION_RUBRICS = {
  componentSeparation: {
    name: 'Component Separation',
    description: 'Are the expected parts of the subject visually distinct from each other? Score relative to what the subject demands — a boulder should be a cohesive mass (high score if it reads as solid rock), while a tank should have clearly separated tracks, hull, and turret (high score only if those parts are individually identifiable). Do NOT penalize subjects for having fewer parts than a complex object.',
    anchors: {
      1: 'The sprite is an undifferentiated mass where no expected parts are identifiable, OR a multi-part subject where all parts bleed into one shape.',
      2: 'For multi-part subjects: parts are vaguely suggested but heavily overlap or share colors. For simple subjects: the form is too broken up or inconsistent to read as a cohesive object.',
      3: 'For multi-part subjects: major components are distinguishable but boundaries are unclear. For simple subjects: the form is mostly cohesive but has distracting artifacts or color breaks.',
      4: 'For multi-part subjects: most components are clearly separated with distinct colors and boundaries. For simple subjects: the form reads cleanly as the intended object with appropriate internal variation (e.g., shading, texture).',
      5: 'For multi-part subjects: every logical component has its own color family and crisp boundaries (e.g., tank has distinct tracks, hull, turret, barrel). For simple subjects: the form is immediately recognizable with natural, purposeful internal detail.',
    },
  },
  colorUsage: {
    name: 'Color Usage',
    description: 'Are colors used effectively? Evaluate contrast, shading depth, and whether the palette choices serve the subject. Judge the visual result — do the colors actually create readable depth and form, or do they just exist in the palette without contributing?',
    anchors: {
      1: 'Only 1-2 colors used, no shading or contrast. Flat and unreadable — the subject has no visual depth.',
      2: 'A few colors used but poorly — low contrast between adjacent areas, no light/dark shading layers, muddy or clashing combinations that make the sprite harder to read.',
      3: 'Adequate color variety with some shading, but inconsistent — some areas have depth while others are flat single-color fills. The palette exists but doesn\'t fully serve the subject.',
      4: 'Good color variety with clear light/dark shading on most components. Colors create readable depth and form. Cohesive palette where colors work together.',
      5: 'Excellent palette utilization with 3+ shade layers per component, strong contrast between adjacent parts, and cohesive color relationships. Every color choice serves the visual — no wasted or redundant palette entries.',
    },
  },
  detailDensity: {
    name: 'Detail Density',
    description: 'How much fine detail is present? Small shapes, textures, highlights?',
    anchors: {
      1: 'Fewer than 10 commands. Only large rectangles, no small details at all.',
      2: 'Basic shapes only (10-20 commands). No textures, patterns, or fine details.',
      3: 'Moderate detail (20-40 commands). Some small shapes for accents but mostly large fills.',
      4: 'Good detail (40-60 commands). Small shapes for textures, highlights, and accents on most components.',
      5: 'Rich detail (60+ commands). Fine textures, tiny highlights, surface patterns (rivets, scales, bricks), and sub-pixel accents throughout.',
    },
  },
  spatialCoverage: {
    name: 'Spatial Coverage',
    description: 'Does the sprite fill the grid appropriately?',
    anchors: {
      1: 'Sprite covers less than 20% of the grid — mostly transparent.',
      2: 'Sprite covers 20-40% — too small or off-center, large empty areas.',
      3: 'Sprite covers 40-60% — decent but leaves noticeable gaps or is poorly centered.',
      4: 'Sprite covers 60-80% — fills most of the grid with appropriate transparent edges.',
      5: 'Sprite covers 80%+ — fills the grid edge-to-edge with only a thin transparent border, well-centered.',
    },
  },
  promptAdherence: {
    name: 'Prompt Adherence',
    description: `Does the visual result look like what was requested? You MUST judge what the rendered pixels look like to a person — NOT what the drawing commands intended to create. This is the most common error: the commands may describe a tank, but if the rendered result looks like a green rectangle with some lines, that is NOT a tank.

CRITICAL: Imagine showing ONLY the rendered pixel grid to someone who has never seen the prompt. Could they identify the subject? If not, the score cannot be above 3.

Common failure modes to watch for:
- A "tank" that looks like a green safe or rectangle (score 2-3, not 5)
- A "water tile" made of straight horizontal lines that don't look like water (score 2, not 5)
- A "knight" where you can see sword and shield but the figure doesn't read as a person (score 3, not 5)
- Correct colours for the subject but the shape/silhouette is wrong or ambiguous (score 3, not 4)

Do NOT give credit for intent. Only score what is visually present in the pixels.`,
    anchors: {
      1: 'The rendered sprite bears no visual resemblance to the prompt — a person could not guess the intended subject from the pixels.',
      2: 'The general category might be guessable (e.g., "some kind of vehicle") but the specific subject is wrong or unrecognizable. Key features mentioned in the prompt are absent or the result could easily be mistaken for something else entirely.',
      3: 'The subject is somewhat recognizable but missing important details mentioned in the prompt, OR the subject is ambiguous — a person might guess correctly but with low confidence. Examples: a tank with no visible turret or tracks, a knight where the figure doesn\'t read as a person, a car where you can\'t tell front from back.',
      4: 'The subject clearly matches the prompt with most requested features visually present and identifiable. A person unfamiliar with the prompt would likely guess the correct subject. Minor details may be missing but the overall impression is correct.',
      5: 'A person could confidently identify the exact subject and its specific features from the pixels alone — subject, orientation, distinguishing features, and key details from the prompt are all visually unambiguous.',
    },
  },
};

const DIMENSIONS = Object.keys(DIMENSION_RUBRICS);

// ---------------------------------------------------------------------------
// Build per-dimension judge prompt using XML structure
// ---------------------------------------------------------------------------

function buildJudgePrompt(dimension) {
  const rubric = DIMENSION_RUBRICS[dimension];

  return `You are evaluating a single quality dimension of a generated pixel art sprite.

<task>
Evaluate the sprite on the "${rubric.name}" dimension: ${rubric.description}
</task>

<rubric>
Score using this 1-5 scale:

${Object.entries(rubric.anchors)
  .map(([score, desc]) => `  ${score} — ${desc}`)
  .join('\n')}
</rubric>

<instructions>
1. First, analyze the drawing commands and statistics in <analysis> tags. Consider what the commands build up visually — what shapes are layered, how colors are distributed, what details are present.
2. Then, compare your analysis against each rubric level to find the best match.
3. Finally, return your score as a JSON object.
</instructions>

<output_format>
After your analysis, return a JSON object with exactly these fields:
{
  "score": <integer 1-5>,
  "reasoning": "<1-2 sentence justification referencing specific evidence from the commands/stats>"
}
</output_format>`;
}

// ---------------------------------------------------------------------------
// Build the user message with sprite data in XML structure
// ---------------------------------------------------------------------------

function buildUserMessage(prompt, commands, stats, hint, width, height) {
  const parts = [
    '<sprite_evaluation>',
    `<original_prompt>${prompt}</original_prompt>`,
  ];

  if (hint) {
    parts.push(`<quality_hint>${hint}</quality_hint>`);
  }

  parts.push(
    `<grid_dimensions>${width}x${height}</grid_dimensions>`,
    '<pixel_statistics>',
    `  Total pixels: ${stats.totalPixels}`,
    `  Filled pixels: ${stats.filledPixels} (${stats.coveragePercent.toFixed(1)}% coverage)`,
    `  Unique colors used: ${stats.uniqueColors} out of ${stats.paletteSize} palette colors (${stats.paletteUtilization.toFixed(1)}% utilization)`,
    `  Total commands: ${stats.commandCount}`,
    `  Commands by type: ${JSON.stringify(stats.commandsByType)}`,
    '</pixel_statistics>',
    '<drawing_commands>',
    JSON.stringify(commands, null, 2),
    '</drawing_commands>',
    '</sprite_evaluation>',
  );

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Code-based pre-checks (fast, deterministic grading layer)
// ---------------------------------------------------------------------------

function computeCodeBasedScores(stats) {
  const scores = {};

  // Spatial coverage — deterministic from pixel data
  const cov = stats.coveragePercent;
  if (cov >= 80) scores.spatialCoverage = 5;
  else if (cov >= 60) scores.spatialCoverage = 4;
  else if (cov >= 40) scores.spatialCoverage = 3;
  else if (cov >= 20) scores.spatialCoverage = 2;
  else scores.spatialCoverage = 1;

  // Detail density — deterministic from command count
  const cmds = stats.commandCount;
  if (cmds >= 60) scores.detailDensity = 5;
  else if (cmds >= 40) scores.detailDensity = 4;
  else if (cmds >= 20) scores.detailDensity = 3;
  else if (cmds >= 10) scores.detailDensity = 2;
  else scores.detailDensity = 1;

  // Color usage — partial signal from palette utilization
  const util = stats.paletteUtilization;
  if (util >= 80) scores.colorUsageHint = 'high';
  else if (util >= 50) scores.colorUsageHint = 'medium';
  else scores.colorUsageHint = 'low';

  return scores;
}

// ---------------------------------------------------------------------------
// Judge a single dimension via LLM
// ---------------------------------------------------------------------------

async function judgeDimension(dimension, prompt, commands, stats, hint, width, height, judgeModel) {
  const systemPrompt = buildJudgePrompt(dimension);
  const userMessage = buildUserMessage(prompt, commands, stats, hint, width, height);

  const responseText = await callOpenRouter(systemPrompt, userMessage, judgeModel);
  const parsed = extractJSON(responseText);

  const score = typeof parsed.score === 'number'
    ? Math.max(1, Math.min(5, Math.round(parsed.score)))
    : 0;
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

  return { score, reasoning };
}

// ---------------------------------------------------------------------------
// Public API: judge a sprite across all dimensions
// ---------------------------------------------------------------------------

/**
 * Judge a generated sprite using per-dimension LLM calls + code-based checks.
 *
 * @param {string} prompt - The original generation prompt
 * @param {Array} commands - The drawing commands produced
 * @param {object} stats - Pixel statistics from computeStats
 * @param {string|null} hint - Optional hint about what a good result looks like
 * @param {string|null} judgeModel - Model to use for judging
 * @param {number} width - Grid width in pixels
 * @param {number} height - Grid height in pixels
 * @returns {object} Quality scores
 */
async function judgeSprite(prompt, commands, stats, hint, judgeModel, width, height) {
  const codeScores = computeCodeBasedScores(stats);

  // LLM judges each dimension independently
  // spatialCoverage and detailDensity use code-based scores (deterministic, fast)
  // componentSeparation, colorUsage, promptAdherence require LLM judgment
  const llmDimensions = ['componentSeparation', 'colorUsage', 'promptAdherence'];

  const scores = {
    spatialCoverage: codeScores.spatialCoverage,
    spatialCoverageReasoning: `Code-based: ${stats.coveragePercent.toFixed(1)}% pixel coverage`,
    detailDensity: codeScores.detailDensity,
    detailDensityReasoning: `Code-based: ${stats.commandCount} drawing commands`,
  };

  try {
    // Run LLM judges sequentially (respects rate limits)
    for (const dim of llmDimensions) {
      const result = await judgeDimension(dim, prompt, commands, stats, hint, width, height, judgeModel);
      scores[dim] = result.score;
      scores[`${dim}Reasoning`] = result.reasoning;
    }

    // Compute overall as average of all 5 dimensions
    scores.overall = DIMENSIONS.reduce((sum, d) => sum + (scores[d] || 0), 0) / DIMENSIONS.length;
    scores.reasoning = DIMENSIONS.map(d =>
      `${DIMENSION_RUBRICS[d].name} (${scores[d]}): ${scores[`${d}Reasoning`] || ''}`
    ).join(' | ');

    return scores;
  } catch (err) {
    return {
      componentSeparation: 0,
      colorUsage: 0,
      detailDensity: codeScores.detailDensity,
      spatialCoverage: codeScores.spatialCoverage,
      promptAdherence: 0,
      overall: 0,
      reasoning: `Judge failed: ${err.message}`,
      status: 'judge-failed',
    };
  }
}

module.exports = { judgeSprite, computeCodeBasedScores, DIMENSIONS, DIMENSION_RUBRICS };
