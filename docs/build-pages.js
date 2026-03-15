'use strict';

const fs = require('fs');
const path = require('path');
const { renderToPNG } = require(path.join(__dirname, '..', 'eval', 'png-encoder.js'));

const RESULTS_DIR = path.join(__dirname, '..', 'eval', 'results');
const DIMENSIONS = ['componentSeparation', 'colorUsage', 'detailDensity', 'spatialCoverage', 'pixelArtDiscipline', 'promptAdherence'];
const DIM_NAMES = {
  componentSeparation: 'Comp Sep',
  colorUsage: 'Color',
  detailDensity: 'Detail',
  spatialCoverage: 'Spatial',
  pixelArtDiscipline: 'Pixel Art',
  promptAdherence: 'Prompt',
};

// Calibration rounds
const CALIBRATION_ROUNDS = [
  { file: 'current_2026-03-14_22-32-06.json', label: 'Round 1', desc: 'Baseline (Sonnet judges Sonnet)' },
  { file: 'current_2026-03-14_23-08-37.json', label: 'Round 2', desc: 'Rubric rewrites' },
  { file: 'current_2026-03-14_23-40-24.json', label: 'Round 3', desc: 'Model separation (Opus judge)' },
  { file: 'current_2026-03-15_06-06-44.json', label: 'Round 4', desc: 'Vision + preChecks' },
  { file: 'current_2026-03-15_12-58-31.json', label: 'Round 5', desc: 'LLM spatial coverage, 30 prompts' },
];

// Generator comparison
const GENERATOR_ROUNDS = [
  { file: 'current_2026-03-15_10-19-28.json', label: 'current', desc: 'Baseline prompt' },
  { file: 'v2_2026-03-15_10-59-47.json', label: 'v2', desc: 'Perspective rules + size guidance' },
  { file: 'v3_2026-03-15_11-26-52.json', label: 'v3', desc: 'Detail emphasis + category guidance' },
];

function loadReport(filename) {
  return JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, filename), 'utf-8'));
}

function spriteToDataURI(pixels, palette, targetSize) {
  if (!pixels || !palette) return null;
  const h = pixels.length;
  const w = pixels[0].length;
  const maxDim = Math.max(w, h);
  const scale = Math.max(1, Math.round(targetSize / maxDim));
  const buf = renderToPNG(pixels, palette, scale);
  return 'data:image/png;base64,' + buf.toString('base64');
}

function computeCalibration(report) {
  const cal = {};
  for (const dim of DIMENSIONS) {
    let absSum = 0, agree = 0, n = 0;
    for (const r of report.results) {
      if (r.status !== 'success' || !r.humanScores || !r.scores) continue;
      const h = r.humanScores[dim], l = r.scores[dim];
      if (h == null || l == null) continue;
      absSum += Math.abs(h - l);
      if (Math.abs(h - l) <= 1) agree++;
      n++;
    }
    cal[dim] = { mad: n > 0 ? absSum / n : null, agreement: n > 0 ? (agree / n) * 100 : null, count: n };
  }
  return cal;
}

function shortPrompt(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

// ---- Build the page ----

const html = [];

// CSS for sprite galleries
html.push(`<style>
.sprite-gallery { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin: 24px 0; }
.sprite-card { background: var(--bg-card, #1c1e28); border: 1px solid var(--border-subtle, #2a2d3a); border-radius: 8px; padding: 12px; text-align: center; width: 200px; }
.sprite-card img { image-rendering: pixelated; background: repeating-conic-gradient(#222 0% 25%, #2a2a2a 0% 50%) 0 0 / 16px 16px; border-radius: 4px; display: block; margin: 0 auto 8px; }
.sprite-card .prompt { font-size: 0.75rem; color: var(--text-secondary, #a09b90); line-height: 1.3; margin-bottom: 6px; min-height: 2.6em; }
.sprite-card .scores { font-size: 0.7rem; color: var(--text-muted, #6b6660); }
.sprite-card .scores .human { color: var(--accent-teal, #3ab5a0); font-weight: 600; }
.sprite-card .scores .llm { color: var(--accent-orange, #e07a3a); }
.round-comparison { margin: 24px 0; }
.round-row { display: flex; gap: 2px; align-items: flex-start; margin-bottom: 16px; background: var(--bg-card, #1c1e28); border-radius: 8px; padding: 12px; flex-wrap: wrap; }
.round-row .row-label { width: 100%; font-size: 0.8rem; color: var(--text-secondary, #a09b90); margin-bottom: 8px; font-weight: 500; }
.round-cell { text-align: center; flex: 1; min-width: 100px; }
.round-cell img { image-rendering: pixelated; background: repeating-conic-gradient(#222 0% 25%, #2a2a2a 0% 50%) 0 0 / 12px 12px; border-radius: 4px; display: block; margin: 0 auto 4px; }
.round-cell .cell-label { font-size: 0.65rem; color: var(--text-muted, #6b6660); }
.round-cell .cell-score { font-size: 0.7rem; font-weight: 600; }
.round-cell .cell-score.good { color: var(--accent-teal, #3ab5a0); }
.round-cell .cell-score.bad { color: var(--accent-red, #c45c4c); }
.round-cell .cell-score.mid { color: var(--accent-gold, #d4ae4e); }
.cal-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.8rem; }
.cal-table th, .cal-table td { padding: 6px 10px; text-align: center; border-bottom: 1px solid var(--border-subtle, #2a2d3a); }
.cal-table th { color: var(--text-secondary, #a09b90); font-weight: 500; font-size: 0.7rem; }
.cal-table td.good { color: var(--accent-teal, #3ab5a0); }
.cal-table td.bad { color: var(--accent-red, #c45c4c); }
.cal-table td.mid { color: var(--accent-gold, #d4ae4e); }
.cal-table td:first-child { text-align: left; color: var(--text-primary, #e8e6e1); }
.section-subtitle { font-family: 'Space Grotesk', sans-serif; font-size: 1.1rem; color: var(--text-primary, #e8e6e1); margin: 32px 0 8px; }
.section-note { font-size: 0.8rem; color: var(--text-muted, #6b6660); margin-bottom: 16px; }
</style>`);

// ==== SECTION 1: Calibration Journey with Sprites ====

html.push('<h3 class="section-subtitle">Sprites Used for Judge Calibration</h3>');
html.push('<p class="section-note">The same prompts generated fresh each round. The sprites differ because LLM output varies, but the generation prompt stayed the same. What changed was the judge.</p>');

// Find prompts that appear in 3+ calibration rounds
const calReports = CALIBRATION_ROUNDS.map(r => ({ ...r, data: loadReport(r.file) }));
const allPrompts = new Map();
for (const round of calReports) {
  for (const r of round.data.results) {
    if (r.status !== 'success') continue;
    const key = r.prompt.prompt;
    if (!allPrompts.has(key)) allPrompts.set(key, []);
    allPrompts.get(key).push({ round: round.label, result: r });
  }
}

// Pick prompts with most round coverage, up to 6
const promptsByFreq = [...allPrompts.entries()]
  .map(([prompt, entries]) => ({ prompt, entries, count: entries.length }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 6);

for (const { prompt, entries } of promptsByFreq) {
  html.push('<div class="round-row">');
  html.push(`<div class="row-label">${shortPrompt(prompt, 80)}</div>`);

  for (const { round, result } of entries) {
    const uri = spriteToDataURI(result.pixels, result.palette, 128);
    const hScore = result.humanScores ? result.humanScores.overall : null;
    const lScore = result.scores ? result.scores.overall : null;
    const scoreClass = hScore >= 4.0 ? 'good' : hScore >= 3.0 ? 'mid' : 'bad';

    html.push('<div class="round-cell">');
    if (uri) html.push(`<img src="${uri}" width="128" height="128" alt="${shortPrompt(prompt, 30)}">`);
    html.push(`<div class="cell-label">${round}</div>`);
    if (hScore != null) html.push(`<div class="cell-score ${scoreClass}">H:${hScore.toFixed(1)} L:${lScore ? lScore.toFixed(1) : '?'}</div>`);
    html.push('</div>');
  }
  html.push('</div>');
}

// Calibration metrics table
html.push('<h3 class="section-subtitle">Calibration Metrics Across Rounds</h3>');
html.push('<p class="section-note">MAD = Mean Absolute Difference (lower is better). Agreement = % of scores within 1 point of human.</p>');

html.push('<table class="cal-table"><thead><tr><th>Dimension</th>');
for (const r of CALIBRATION_ROUNDS) {
  html.push(`<th>${r.label}<br><span style="font-weight:400">${r.desc.split('(')[0].trim()}</span></th>`);
}
html.push('</tr></thead><tbody>');

const calData = calReports.map(r => computeCalibration(r.data));
for (const dim of DIMENSIONS) {
  html.push(`<tr><td>${DIM_NAMES[dim]}</td>`);
  for (let i = 0; i < calData.length; i++) {
    const c = calData[i][dim];
    if (c.mad != null) {
      const cls = c.mad <= 0.7 ? 'good' : c.mad <= 1.0 ? 'mid' : 'bad';
      html.push(`<td class="${cls}">${c.mad.toFixed(2)}</td>`);
    } else {
      html.push('<td>-</td>');
    }
  }
  html.push('</tr>');
}
html.push('</tbody></table>');

// ==== SECTION 2: Generator Improvement Rounds ====

html.push('<h3 class="section-subtitle">Generator Prompt Iterations</h3>');
html.push('<p class="section-note">Same judge, different generation prompts. The baseline (current) outperformed both v2 and v3. More prescriptive instructions made sprites worse.</p>');

const genReports = GENERATOR_ROUNDS.map(r => ({ ...r, data: loadReport(r.file) }));

// Find prompts common to all 3
const genPrompts = new Map();
for (const result of genReports[0].data.results) {
  if (result.status !== 'success') continue;
  const key = result.prompt.prompt;
  const inAll = genReports.every(r => r.data.results.some(x => x.prompt.prompt === key && x.status === 'success'));
  if (inAll) genPrompts.set(key, true);
}

// Pick 6 prompts with biggest score difference
const genComparisons = [];
for (const [prompt] of genPrompts) {
  const scores = genReports.map(r => {
    const result = r.data.results.find(x => x.prompt.prompt === prompt);
    return result && result.humanScores ? result.humanScores.overall : null;
  });
  if (scores.every(s => s != null)) {
    const spread = Math.max(...scores) - Math.min(...scores);
    genComparisons.push({ prompt, scores, spread });
  }
}
genComparisons.sort((a, b) => b.spread - a.spread);

for (const { prompt } of genComparisons.slice(0, 8)) {
  html.push('<div class="round-row">');
  html.push(`<div class="row-label">${shortPrompt(prompt, 80)}</div>`);

  for (const genRound of genReports) {
    const result = genRound.data.results.find(x => x.prompt.prompt === prompt);
    if (!result || result.status !== 'success') {
      html.push('<div class="round-cell"><div class="cell-label">' + genRound.label + '</div><div class="cell-score bad">failed</div></div>');
      continue;
    }
    const uri = spriteToDataURI(result.pixels, result.palette, 128);
    const hScore = result.humanScores ? result.humanScores.overall : null;
    const scoreClass = hScore >= 4.0 ? 'good' : hScore >= 3.0 ? 'mid' : 'bad';

    html.push('<div class="round-cell">');
    if (uri) html.push(`<img src="${uri}" width="128" height="128" alt="${shortPrompt(prompt, 30)}">`);
    html.push(`<div class="cell-label">${genRound.label}</div>`);
    if (hScore != null) html.push(`<div class="cell-score ${scoreClass}">H:${hScore.toFixed(1)}</div>`);
    html.push('</div>');
  }
  html.push('</div>');
}

// Generator scores table
html.push('<h3 class="section-subtitle">Human Scores by Generator Version</h3>');
html.push('<table class="cal-table"><thead><tr><th>Dimension</th>');
for (const r of GENERATOR_ROUNDS) {
  html.push(`<th>${r.label}</th>`);
}
html.push('</tr></thead><tbody>');

for (const dim of [...DIMENSIONS, 'overall']) {
  html.push(`<tr><td>${dim === 'overall' ? '<strong>OVERALL</strong>' : DIM_NAMES[dim]}</td>`);
  for (const genRound of genReports) {
    const graded = genRound.data.results.filter(r => r.status === 'success' && r.humanScores);
    if (graded.length === 0) { html.push('<td>-</td>'); continue; }
    let avg;
    if (dim === 'overall') {
      avg = graded.reduce((s, r) => s + r.humanScores.overall, 0) / graded.length;
    } else {
      avg = graded.reduce((s, r) => s + (r.humanScores[dim] || 0), 0) / graded.length;
    }
    const cls = avg >= 4.0 ? 'good' : avg >= 3.5 ? 'mid' : 'bad';
    html.push(`<td class="${cls}">${avg.toFixed(2)}</td>`);
  }
  html.push('</tr>');
}
html.push('</tbody></table>');

// ==== SECTION 3: Best and worst from latest round ====

html.push('<h3 class="section-subtitle">Round 5: Best and Worst Sprites</h3>');
html.push('<p class="section-note">The latest round with 30 prompts, expanded categories, and LLM-judged spatial coverage.</p>');

const latest = loadReport('current_2026-03-15_12-58-31.json');
const graded = latest.results.filter(r => r.status === 'success' && r.humanScores);
graded.sort((a, b) => b.humanScores.overall - a.humanScores.overall);

html.push('<h4 style="color: var(--accent-teal); font-size: 0.9rem; margin: 16px 0 8px;">Top Scoring</h4>');
html.push('<div class="sprite-gallery">');
for (const r of graded.slice(0, 8)) {
  const uri = spriteToDataURI(r.pixels, r.palette, 160);
  html.push('<div class="sprite-card">');
  if (uri) html.push(`<img src="${uri}" width="160" height="160" alt="">`);
  html.push(`<div class="prompt">${shortPrompt(r.prompt.prompt, 60)}</div>`);
  html.push(`<div class="scores"><span class="human">H:${r.humanScores.overall.toFixed(1)}</span> <span class="llm">L:${r.scores.overall.toFixed(1)}</span></div>`);
  html.push('</div>');
}
html.push('</div>');

html.push('<h4 style="color: var(--accent-red); font-size: 0.9rem; margin: 16px 0 8px;">Lowest Scoring</h4>');
html.push('<div class="sprite-gallery">');
for (const r of graded.slice(-6).reverse()) {
  const uri = spriteToDataURI(r.pixels, r.palette, 160);
  html.push('<div class="sprite-card">');
  if (uri) html.push(`<img src="${uri}" width="160" height="160" alt="">`);
  html.push(`<div class="prompt">${shortPrompt(r.prompt.prompt, 60)}</div>`);
  html.push(`<div class="scores"><span class="human">H:${r.humanScores.overall.toFixed(1)}</span> <span class="llm">L:${r.scores.overall.toFixed(1)}</span></div>`);
  html.push('</div>');
}
html.push('</div>');

// Write the output
const output = html.join('\n');
fs.writeFileSync(path.join(__dirname, 'sprite-content.html'), output);
console.log(`Generated sprite-content.html (${(output.length / 1024).toFixed(1)} KB)`);
console.log(`Calibration sprites: ${promptsByFreq.length} prompts across rounds`);
console.log(`Generator comparisons: ${Math.min(8, genComparisons.length)} prompts`);
console.log(`Best/worst: ${graded.length} graded sprites`);
