'use strict';

const fs = require('fs');
const path = require('path');
const { renderToPNG } = require('./png-encoder');

const RESULTS_DIR = path.join(__dirname, 'results');
const OUTPUT_DIR = '/home/matthew/Desktop/sprite-judge-calibration-blog/sprites-round5';

// Only export from these graded reports — label disambiguates same-version reports
const REPORT_FILES = [
  { file: 'current_2026-03-15_12-58-31.json', label: 'current-r5' },
  { file: 'current_2026-03-15_06-06-44.json', label: 'current-r4' },
  { file: 'v2_2026-03-15_10-59-47.json',      label: 'v2' },
  { file: 'v3_2026-03-15_11-26-52.json',      label: 'v3' },
];

// Scale factor to aim for ~256px output
function scaleForSize(size) {
  if (size <= 32) return 8;
  if (size <= 48) return 6;
  return 4; // 64px
}

function slugify(text, wordCount) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, wordCount)
    .join('-');
}

function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary = [];
  let exportCount = 0;

  for (const { file: filename, label } of REPORT_FILES) {
    const filepath = path.join(RESULTS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`Warning: report not found: ${filename}`);
      continue;
    }

    const report = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    const version = label;

    console.log(`Processing ${filename} (label: ${label}, ${report.results.length} results)`);

    for (const result of report.results) {
      if (result.status !== 'success' || !result.pixels || !result.palette) {
        continue;
      }

      const prompt = result.prompt;
      const promptSlug = slugify(prompt.prompt, 3);
      const category = prompt.category || 'unknown';
      const outName = `${version}_${category}_${promptSlug}.png`;

      const maxDim = Math.max(prompt.width, prompt.height);
      const scale = scaleForSize(maxDim);

      const pngBuf = renderToPNG(result.pixels, result.palette, scale);
      const outPath = path.join(OUTPUT_DIR, outName);
      fs.writeFileSync(outPath, pngBuf);
      exportCount++;

      const entry = {
        file: outName,
        version,
        category,
        prompt: prompt.prompt,
        width: prompt.width,
        height: prompt.height,
        scale,
        difficulty: prompt.difficulty,
        sourceReport: filename,
      };

      // Include LLM scores if present
      if (result.scores) {
        entry.llmScores = {
          componentSeparation: result.scores.componentSeparation,
          colorUsage: result.scores.colorUsage,
          detailDensity: result.scores.detailDensity,
          spatialCoverage: result.scores.spatialCoverage,
          pixelArtDiscipline: result.scores.pixelArtDiscipline,
          promptAdherence: result.scores.promptAdherence,
          overall: result.scores.overall,
        };
      }

      // Include human scores if present
      if (result.humanScores) {
        entry.humanScores = {
          componentSeparation: result.humanScores.componentSeparation,
          colorUsage: result.humanScores.colorUsage,
          detailDensity: result.humanScores.detailDensity,
          spatialCoverage: result.humanScores.spatialCoverage,
          pixelArtDiscipline: result.humanScores.pixelArtDiscipline,
          promptAdherence: result.humanScores.promptAdherence,
          overall: result.humanScores.overall,
          notes: result.humanScores.notes,
        };
      }

      summary.push(entry);
    }
  }

  // Write summary JSON
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\nExported ${exportCount} sprites to ${OUTPUT_DIR}`);
  console.log(`Summary written to ${summaryPath}`);
}

main();
