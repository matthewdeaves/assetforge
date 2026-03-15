'use strict';

const fs = require('fs');
const path = require('path');
const { rasterize } = require(path.join(__dirname, '..', 'server', 'services', 'rasterizer.js'));
const { callOpenRouter, extractJSON } = require(path.join(__dirname, '..', 'server', 'services', 'llm.js'));
const { computeStats } = require(path.join(__dirname, 'stats.js'));
const { judgeSprite, DIMENSIONS } = require(path.join(__dirname, 'judge.js'));

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    systemPrompt: 'current',
    promptSet: 'default',
    genModel: null,
    judgeModel: null,
    variants: 1,
  };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--system-prompt':
        args.systemPrompt = argv[++i];
        break;
      case '--prompt-set':
        args.promptSet = argv[++i];
        break;
      case '--gen-model':
        args.genModel = argv[++i];
        break;
      case '--judge-model':
        args.judgeModel = argv[++i];
        break;
      case '--variants': {
        const val = argv[++i];
        if (val === undefined || isNaN(parseInt(val))) {
          console.error('--variants requires an integer value (e.g., --variants 3)');
          process.exit(1);
        }
        args.variants = Math.max(1, parseInt(val));
        break;
      }
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Prompt set loading with validation (T011)
// ---------------------------------------------------------------------------

function loadPromptSet(name) {
  const filePath = path.join(__dirname, 'prompt-sets', `${name}.json`);

  if (!fs.existsSync(filePath)) {
    const available = fs.readdirSync(path.join(__dirname, 'prompt-sets'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    console.error(`Prompt set "${name}" not found at: ${filePath}`);
    console.error(`Available prompt sets: ${available.join(', ') || '(none)'}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`Failed to parse prompt set "${name}": ${err.message}`);
    process.exit(1);
  }

  if (!data.name || !Array.isArray(data.prompts)) {
    console.error(`Invalid prompt set structure: must have "name" (string) and "prompts" (array)`);
    process.exit(1);
  }

  for (let i = 0; i < data.prompts.length; i++) {
    const p = data.prompts[i];
    if (!p.prompt || typeof p.prompt !== 'string') {
      console.error(`Prompt ${i}: missing or invalid "prompt" field`);
      process.exit(1);
    }
    if (typeof p.width !== 'number' || typeof p.height !== 'number') {
      console.error(`Prompt ${i} ("${p.prompt.slice(0, 30)}..."): missing or invalid width/height`);
      process.exit(1);
    }
    if (p.difficulty !== undefined && !['simple', 'medium', 'hard'].includes(p.difficulty)) {
      console.error(`Prompt ${i} ("${p.prompt.slice(0, 30)}..."): difficulty must be "simple", "medium", or "hard"`);
      process.exit(1);
    }
    if (p.colorHints !== undefined && typeof p.colorHints !== 'string') {
      console.error(`Prompt ${i} ("${p.prompt.slice(0, 30)}..."): colorHints must be a string`);
      process.exit(1);
    }
    if (p.expectedComponents !== undefined && (!Array.isArray(p.expectedComponents) || !p.expectedComponents.every(c => typeof c === 'string'))) {
      console.error(`Prompt ${i} ("${p.prompt.slice(0, 30)}..."): expectedComponents must be an array of strings`);
      process.exit(1);
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// System prompt loading
// ---------------------------------------------------------------------------

function loadSystemPrompt(version) {
  const filePath = path.join(__dirname, 'system-prompts', `${version}.js`);

  if (!fs.existsSync(filePath)) {
    const available = fs.readdirSync(path.join(__dirname, 'system-prompts'))
      .filter(f => f.endsWith('.js'))
      .map(f => f.replace('.js', ''));
    console.error(`System prompt "${version}" not found at: ${filePath}`);
    console.error(`Available system prompts: ${available.join(', ') || '(none)'}`);
    process.exit(1);
  }

  const mod = require(filePath);
  if (typeof mod.buildSystemPrompt !== 'function') {
    console.error(`System prompt module "${version}" must export buildSystemPrompt(width, height)`);
    process.exit(1);
  }

  return mod;
}

// ---------------------------------------------------------------------------
// API key validation (T012)
// ---------------------------------------------------------------------------

function validateApiKey() {
  if (process.env.OPENROUTER_API_KEY) return;

  const dockerPath = '/app/openrouterkey';
  if (fs.existsSync(dockerPath)) return;

  const localPath = path.resolve('./openrouterkey');
  if (fs.existsSync(localPath)) return;

  console.error('OpenRouter API key not found.');
  console.error('Set OPENROUTER_API_KEY env var, or create an openrouterkey file in the project root.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Sprite generation with custom system prompt
// ---------------------------------------------------------------------------

async function generateSpriteWithPrompt(prompt, systemPromptBuilder, width, height, genModel) {
  // Build free-color system prompt (no palette provided)
  const basePrompt = systemPromptBuilder(width, height);
  const systemPrompt = [
    basePrompt,
    '',
    'No palette is provided. You must define your own palette.',
    'The "color" field in commands refers to a palette index (integer).',
    'Index 0 is always transparent.',
    '',
    'Return a JSON object with two fields:',
    '  { "commands": [ ...drawing commands... ], "palette": [ ...colors... ] }',
    'The palette is an array of {r, g, b} objects (0-255). Index 0 should be black (it represents transparent).',
    'Choose colors that work well together for the described sprite.',
    '',
    'Return ONLY the JSON object. No explanation.',
  ].join('\n');

  const responseText = await callOpenRouter(systemPrompt, prompt, genModel || undefined);
  const parsed = extractJSON(responseText);

  if (Array.isArray(parsed)) {
    return { commands: parsed, palette: null };
  }

  return {
    commands: parsed.commands || [],
    palette: parsed.palette || null,
  };
}

// ---------------------------------------------------------------------------
// Main eval loop
// ---------------------------------------------------------------------------

async function runEval(args) {
  validateApiKey();

  const promptSet = loadPromptSet(args.promptSet);
  const systemPromptMod = loadSystemPrompt(args.systemPrompt);

  const genModel = args.genModel || process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4-6';
  const judgeModel = args.judgeModel || 'anthropic/claude-opus-4-6';

  console.log(`\n=== Sprite Eval Harness ===`);
  console.log(`System prompt: ${args.systemPrompt}`);
  console.log(`Prompt set:    ${promptSet.name} (${promptSet.prompts.length} prompts)`);
  console.log(`Gen model:     ${genModel}`);
  console.log(`Judge model:   ${judgeModel}`);
  if (args.variants > 1) console.log(`Variants:      ${args.variants} per prompt`);
  console.log(`${'='.repeat(40)}\n`);

  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < promptSet.prompts.length; i++) {
    if (interrupted) {
      console.log('\nInterrupted — saving partial results...');
      break;
    }

    const testPrompt = promptSet.prompts[i];
    const numVariants = args.variants;

    const result = {
      prompt: testPrompt,
      status: 'success',
      commands: null,
      pixels: null,
      palette: null,
      stats: null,
      scores: null,
      generationTimeMs: 0,
      judgingTimeMs: 0,
      error: null,
    };

    if (numVariants > 1) {
      // Multi-shot: generate N variants, select the best
      const variants = [];
      let totalGenMs = 0;
      let totalJudgeMs = 0;

      for (let v = 0; v < numVariants; v++) {
        if (interrupted) break;
        console.log(`[${i + 1}/${promptSet.prompts.length}] "${testPrompt.prompt.slice(0, 50)}..." (variant ${v + 1}/${numVariants})`);

        const variant = {
          commands: null,
          pixels: null,
          palette: null,
          stats: null,
          scores: null,
          generationTimeMs: 0,
          judgingTimeMs: 0,
          error: null,
        };

        try {
          const genStart = Date.now();
          const generated = await generateSpriteWithPrompt(
            testPrompt.prompt,
            systemPromptMod.buildSystemPrompt,
            testPrompt.width,
            testPrompt.height,
            genModel,
          );
          variant.generationTimeMs = Date.now() - genStart;
          variant.commands = generated.commands;
          variant.palette = generated.palette || [{ r: 0, g: 0, b: 0 }];

          const { pixels } = rasterize(testPrompt.width, testPrompt.height, variant.commands, variant.palette.length);
          variant.pixels = pixels;
          variant.stats = computeStats(pixels, variant.palette, variant.commands);

          const judgeStart = Date.now();
          variant.scores = await judgeSprite(
            testPrompt.prompt,
            variant.commands,
            variant.stats,
            testPrompt.hint || null,
            judgeModel,
            testPrompt.width,
            testPrompt.height,
            variant.pixels,
            variant.palette,
          );
          variant.judgingTimeMs = Date.now() - judgeStart;

          console.log(`  → Variant ${v + 1}: Overall ${variant.scores.overall.toFixed(1)}/5`);
        } catch (err) {
          variant.error = err.message;
          console.log(`  ✗ Variant ${v + 1} failed: ${err.message}`);
        }

        totalGenMs += variant.generationTimeMs;
        totalJudgeMs += variant.judgingTimeMs;
        variants.push(variant);
      }

      // Select best variant by overall score
      let bestIdx = 0;
      let bestScore = -1;
      for (let v = 0; v < variants.length; v++) {
        const s = variants[v].scores ? variants[v].scores.overall : -1;
        if (s > bestScore) {
          bestScore = s;
          bestIdx = v;
        }
      }

      const selected = variants[bestIdx];
      if (selected.scores && !selected.error) {
        result.commands = selected.commands;
        result.pixels = selected.pixels;
        result.palette = selected.palette;
        result.stats = selected.stats;
        result.scores = selected.scores;
        result.status = selected.scores.status === 'judge-failed' ? 'judge-failed' : 'success';
      } else {
        result.status = 'generation-failed';
        result.error = selected.error || 'All variants failed';
      }

      result.generationTimeMs = totalGenMs;
      result.judgingTimeMs = totalJudgeMs;
      result.selectedVariantIndex = bestIdx;
      result.variants = variants;

      if (result.scores) {
        console.log(`  ★ Selected variant ${bestIdx + 1} (${bestScore.toFixed(1)}/5) | Coverage: ${result.stats.coveragePercent.toFixed(0)}% | Commands: ${result.stats.commandCount} (${(totalGenMs / 1000).toFixed(1)}s gen, ${(totalJudgeMs / 1000).toFixed(1)}s judge)`);
      }
    } else {
      // Single-shot: current behaviour
      console.log(`[${i + 1}/${promptSet.prompts.length}] "${testPrompt.prompt.slice(0, 50)}..."`);

      try {
        const genStart = Date.now();
        const generated = await generateSpriteWithPrompt(
          testPrompt.prompt,
          systemPromptMod.buildSystemPrompt,
          testPrompt.width,
          testPrompt.height,
          genModel,
        );
        result.generationTimeMs = Date.now() - genStart;
        result.commands = generated.commands;
        result.palette = generated.palette || [{ r: 0, g: 0, b: 0 }];

        const { pixels } = rasterize(testPrompt.width, testPrompt.height, result.commands, result.palette.length);
        result.pixels = pixels;
        result.stats = computeStats(pixels, result.palette, result.commands);

        const judgeStart = Date.now();
        result.scores = await judgeSprite(
          testPrompt.prompt,
          result.commands,
          result.stats,
          testPrompt.hint || null,
          judgeModel,
          testPrompt.width,
          testPrompt.height,
          result.pixels,
          result.palette,
        );
        result.judgingTimeMs = Date.now() - judgeStart;

        if (result.scores.status === 'judge-failed') {
          result.status = 'judge-failed';
        }

        console.log(`  → Overall: ${result.scores.overall.toFixed(1)}/5 | Coverage: ${result.stats.coveragePercent.toFixed(0)}% | Commands: ${result.stats.commandCount} (${(result.generationTimeMs / 1000).toFixed(1)}s gen, ${(result.judgingTimeMs / 1000).toFixed(1)}s judge)`);
      } catch (err) {
        result.status = 'generation-failed';
        result.error = err.message;
        console.log(`  ✗ Failed: ${err.message}`);
      }
    }

    results.push(result);
  }

  const totalTimeMs = Date.now() - startTime;

  // Compute summary
  const successful = results.filter(r => r.status === 'success');
  const averages = {};

  if (successful.length > 0) {
    for (const dim of DIMENSIONS) {
      averages[dim] = successful.reduce((sum, r) => sum + r.scores[dim], 0) / successful.length;
    }
    averages.overall = DIMENSIONS.reduce((sum, d) => sum + averages[d], 0) / DIMENSIONS.length;
    averages.reasoning = '(average across all successful results)';
  }

  const summary = {
    averages,
    scoreScale: '1-5',
    totalPrompts: results.length,
    successCount: successful.length,
    failedCount: results.length - successful.length,
    totalTimeMs,
  };

  // Print summary table
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${successful.length}/${results.length} prompts scored | ${(totalTimeMs / 1000).toFixed(1)}s total`);
  console.log(`Scale: 1-5 (code-based: detailDensity | LLM-judged: rest)`);
  console.log(`${'='.repeat(60)}`);

  if (successful.length > 0) {
    console.log(`\n  Dimension             Avg Score  Method`);
    console.log(`  ${'─'.repeat(50)}`);
    const codeBasedDims = ['detailDensity'];
    for (const dim of DIMENSIONS) {
      const method = codeBasedDims.includes(dim) ? 'code' : 'LLM';
      console.log(`  ${dim.padEnd(24)} ${averages[dim].toFixed(1)}/5     ${method}`);
    }
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  ${'OVERALL'.padEnd(24)} ${averages.overall.toFixed(1)}/5`);
  }

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const reportFilename = `${args.systemPrompt}_${timestamp}.json`;
  const reportPath = path.join(__dirname, 'results', reportFilename);

  const report = {
    timestamp: new Date().toISOString(),
    systemPromptVersion: args.systemPrompt,
    generationModel: genModel,
    judgingModel: judgeModel,
    promptSetName: promptSet.name,
    ...(args.variants > 1 ? { variantsPerPrompt: args.variants } : {}),
    results,
    summary,
  };

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved: ${reportPath}\n`);

  return report;
}

// ---------------------------------------------------------------------------
// Graceful interrupt handling (T013)
// ---------------------------------------------------------------------------

let interrupted = false;

process.on('SIGINT', () => {
  if (interrupted) {
    console.log('\nForce quit.');
    process.exit(1);
  }
  console.log('\nReceived SIGINT — finishing current prompt, then saving partial results...');
  interrupted = true;
});

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv);
runEval(args).catch(err => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
