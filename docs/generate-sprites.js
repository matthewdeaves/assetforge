'use strict';

const fs = require('fs');
const path = require('path');
const { renderToPNG } = require(path.join(__dirname, '..', 'eval', 'png-encoder.js'));

const RESULTS_DIR = path.join(__dirname, '..', 'eval', 'results');

function loadReport(filename) {
  return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, filename), 'utf8'));
}

function spriteToDataURI(result, scale) {
  const buf = renderToPNG(result.pixels, result.palette, scale);
  return 'data:image/png;base64,' + buf.toString('base64');
}

function getScale(width) {
  if (width <= 32) return 6;
  if (width <= 48) return 4;
  if (width <= 64) return 3;
  return 2; // for 96px wide sprites
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scoreClass(val) {
  if (val >= 4.5) return 'good';
  if (val >= 3.5) return 'okay';
  return 'bad';
}

// Load reports
const current = loadReport('current_2026-03-15_12-58-31.json');
const v2 = loadReport('v2_2026-03-15_10-59-47.json');
const v3 = loadReport('v3_2026-03-15_11-26-52.json');

// ========== 1. Best Sprites Gallery (top 8 by human score) ==========

const bestSprites = current.results
  .filter(r => r.status === 'success' && r.humanScores)
  .sort((a, b) => (b.humanScores.overall || 0) - (a.humanScores.overall || 0))
  .slice(0, 8);

let bestHTML = '<div class="sprite-showcase">\n';
for (const sprite of bestSprites) {
  const scale = getScale(sprite.prompt.width);
  const dataURI = spriteToDataURI(sprite, scale);
  const promptText = sprite.prompt.prompt;
  const humanScore = sprite.humanScores.overall;
  const llmScore = sprite.scores.overall;
  const size = `${sprite.prompt.width}x${sprite.prompt.height}`;

  bestHTML += `  <div class="sprite-card">
    <div class="sprite-img-wrap"><img src="${dataURI}" alt="${escapeHTML(promptText)}" loading="lazy"></div>
    <div class="sprite-info">
      <div class="sprite-prompt">${escapeHTML(promptText)}</div>
      <div class="sprite-scores">
        <span class="sprite-score"><span class="score-label">Human</span> <span class="score-value ${scoreClass(humanScore)}">${humanScore.toFixed(1)}</span></span>
        <span class="sprite-score"><span class="score-label">LLM</span> <span class="score-value ${scoreClass(llmScore)}">${llmScore.toFixed(1)}</span></span>
        <span class="sprite-size">${size}</span>
      </div>
    </div>
  </div>\n`;
}
bestHTML += '</div>';

// ========== 2. Version Comparison (5 sprites common to all 3) ==========

// Find common prompts
function findMatch(results, promptPrefix) {
  return results.find(r => r.status === 'success' && r.humanScores && r.prompt.prompt.startsWith(promptPrefix));
}

// Pick 5 interesting comparisons that show current > v2 > v3
const comparisonPrompts = [];
const currentSuccessful = current.results.filter(r => r.status === 'success' && r.humanScores);

for (const sprite of currentSuccessful) {
  const prefix = sprite.prompt.prompt.substring(0, 30);
  const v2Match = findMatch(v2.results, prefix);
  const v3Match = findMatch(v3.results, prefix);
  if (v2Match && v3Match) {
    comparisonPrompts.push({
      prompt: sprite.prompt.prompt,
      current: sprite,
      v2: v2Match,
      v3: v3Match,
      diff: sprite.humanScores.overall - v3Match.humanScores.overall
    });
  }
}

// Sort by biggest difference to show most dramatic comparisons
comparisonPrompts.sort((a, b) => b.diff - a.diff);
const selectedComparisons = comparisonPrompts.slice(0, 5);

let compHTML = '<div class="version-comparison">\n';
for (const comp of selectedComparisons) {
  const promptShort = comp.prompt.length > 80 ? comp.prompt.substring(0, 77) + '...' : comp.prompt;
  compHTML += `  <div class="comparison-row">
    <div class="comparison-label">${escapeHTML(promptShort)}</div>
    <div class="comparison-sprites">\n`;

  for (const [label, sprite] of [['Current', comp.current], ['v2', comp.v2], ['v3', comp.v3]]) {
    const scale = getScale(sprite.prompt.width);
    const dataURI = spriteToDataURI(sprite, scale);
    const humanScore = sprite.humanScores.overall;
    compHTML += `      <div class="comparison-sprite">
        <div class="comparison-version">${label}</div>
        <div class="sprite-img-wrap"><img src="${dataURI}" alt="${label}" loading="lazy"></div>
        <div class="comparison-score ${scoreClass(humanScore)}">${humanScore.toFixed(1)}</div>
      </div>\n`;
  }

  compHTML += `    </div>
  </div>\n`;
}
compHTML += '</div>';

// ========== 3. Challenging Subjects Gallery (lower-scoring complex sprites) ==========

const challengingSprites = current.results
  .filter(r => r.status === 'success' && r.humanScores && r.humanScores.overall <= 3.5)
  .sort((a, b) => (a.humanScores.overall || 0) - (b.humanScores.overall || 0))
  .slice(0, 6);

let challengeHTML = '<div class="sprite-showcase">\n';
for (const sprite of challengingSprites) {
  const scale = getScale(sprite.prompt.width);
  const dataURI = spriteToDataURI(sprite, scale);
  const promptText = sprite.prompt.prompt;
  const humanScore = sprite.humanScores.overall;
  const llmScore = sprite.scores.overall;
  const size = `${sprite.prompt.width}x${sprite.prompt.height}`;

  challengeHTML += `  <div class="sprite-card">
    <div class="sprite-img-wrap"><img src="${dataURI}" alt="${escapeHTML(promptText)}" loading="lazy"></div>
    <div class="sprite-info">
      <div class="sprite-prompt">${escapeHTML(promptText)}</div>
      <div class="sprite-scores">
        <span class="sprite-score"><span class="score-label">Human</span> <span class="score-value ${scoreClass(humanScore)}">${humanScore.toFixed(1)}</span></span>
        <span class="sprite-score"><span class="score-label">LLM</span> <span class="score-value ${scoreClass(llmScore)}">${llmScore.toFixed(1)}</span></span>
        <span class="sprite-size">${size}</span>
      </div>
    </div>
  </div>\n`;
}
challengeHTML += '</div>';

// ========== Write output ==========

const output = {
  bestSprites: bestHTML,
  versionComparison: compHTML,
  challengingSprites: challengeHTML
};

fs.writeFileSync(path.join(__dirname, 'sprite-data.json'), JSON.stringify(output, null, 2));
console.log(`Generated sprite data:`);
console.log(`  Best sprites: ${bestSprites.length} sprites`);
console.log(`  Version comparisons: ${selectedComparisons.length} comparisons`);
console.log(`  Challenging sprites: ${challengingSprites.length} sprites`);
console.log(`  Output: docs/sprite-data.json`);
