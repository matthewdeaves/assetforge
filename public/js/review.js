'use strict';

// ---------------------------------------------------------------------------
// Dimension rubrics (hardcoded from eval/judge.js since plain JS can't import)
// ---------------------------------------------------------------------------

const DIMENSION_RUBRICS = {
  componentSeparation: {
    name: 'Component Separation',
    description: 'Are expected parts visually distinct? Score relative to what the subject demands.',
    anchors: {
      1: 'Undifferentiated mass, no expected parts identifiable.',
      2: 'Multi-part: parts overlap/share colors. Simple: form too broken up.',
      3: 'Multi-part: components distinguishable but boundaries unclear. Simple: mostly cohesive but artifacts.',
      4: 'Multi-part: most components clearly separated. Simple: reads cleanly as intended object.',
      5: 'Multi-part: every component has own color family and crisp boundaries. Simple: immediately recognizable.',
    },
  },
  colorUsage: {
    name: 'Color Usage',
    description: 'Are colors used effectively? Do they create readable depth and form?',
    anchors: {
      1: 'Only 1-2 colors, no shading. Flat and unreadable.',
      2: 'Few colors, poorly used — low contrast, no shading layers.',
      3: 'Adequate variety with some shading, but inconsistent depth.',
      4: 'Good variety with clear shading creating readable depth. Cohesive palette.',
      5: 'Excellent palette with 3+ shade layers, strong contrast, every color serves the visual.',
    },
  },
  detailDensity: {
    name: 'Detail Density',
    description: 'How much fine detail is present? Small shapes, textures, highlights?',
    anchors: {
      1: 'Fewer than 10 commands, only large rectangles.',
      2: 'Basic shapes only (10-20 commands), no fine details.',
      3: 'Moderate detail (20-40 commands), some small accents.',
      4: 'Good detail (40-60 commands), textures and highlights.',
      5: 'Rich detail (60+ commands), fine textures throughout.',
    },
  },
  spatialCoverage: {
    name: 'Spatial Coverage',
    description: 'Does the sprite fill the grid appropriately?',
    anchors: {
      1: 'Less than 20% coverage — mostly transparent.',
      2: '20-40% — too small or off-center.',
      3: '40-60% — decent but noticeable gaps.',
      4: '60-80% — fills most of the grid well.',
      5: '80%+ — fills edge-to-edge, well-centered.',
    },
  },
  promptAdherence: {
    name: 'Prompt Adherence',
    description: 'Does the visual result look like what was requested? Judge the rendered pixels, not intent.',
    anchors: {
      1: 'No visual resemblance — can\'t guess the subject from the pixels.',
      2: 'General category guessable but specific subject unrecognizable.',
      3: 'Subject somewhat recognizable but missing important prompted details.',
      4: 'Subject clearly matches with most prompted features visually present.',
      5: 'Could identify exact subject and specific features from pixels alone.',
    },
  },
};

const DIMENSIONS = Object.keys(DIMENSION_RUBRICS);
const PIXEL_SCALE = 8;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let reportList = [];
let currentReport = null;
let currentFilename = '';
let successResults = [];    // filtered to status==="success", with original index
let currentIndex = 0;
let focusedDimIndex = 0;
let collectedScores = [];   // { index, humanScores } for each graded sprite
let skippedCount = 0;
let gradingInProgress = false;

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const reportSelect = document.getElementById('report-select');
const progressEl = document.getElementById('progress');
const emptyState = document.getElementById('empty-state');
const emptyMessage = document.getElementById('empty-message');
const regradeBanner = document.getElementById('regrade-banner');
const spriteView = document.getElementById('sprite-view');
const summaryView = document.getElementById('summary-view');
const canvas = document.getElementById('sprite-canvas');
const ctx = canvas.getContext('2d');
const promptText = document.getElementById('prompt-text');
const qualityHint = document.getElementById('quality-hint');
const statCoverage = document.getElementById('stat-coverage');
const statCommands = document.getElementById('stat-commands');
const statPalette = document.getElementById('stat-palette');
const dimensionsEl = document.getElementById('dimensions');
const btnNext = document.getElementById('btn-next');
const btnSkip = document.getElementById('btn-skip');
const btnFinish = document.getElementById('btn-finish');
const btnViewResults = document.getElementById('btn-view-results');
const btnRegrade = document.getElementById('btn-regrade');

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchReports() {
  const res = await fetch('/api/eval/reports');
  const data = await res.json();
  return data.reports || [];
}

async function fetchReport(filename) {
  const res = await fetch(`/api/eval/reports/${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error('Failed to load report');
  return res.json();
}

async function saveHumanScores(filename, scores) {
  const res = await fetch(`/api/eval/reports/${encodeURIComponent(filename)}/human-scores`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scores }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save scores');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderSprite(pixels, palette, canvasEl) {
  if (!pixels || !palette) return;
  const height = pixels.length;
  const width = pixels[0].length;
  canvasEl.width = width * PIXEL_SCALE;
  canvasEl.height = height * PIXEL_SCALE;
  const c = canvasEl.getContext('2d');
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y][x];
      if (idx === 0) continue; // transparent
      const color = palette[idx];
      if (!color) continue;
      c.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      c.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
    }
  }
}

function buildDimensionUI() {
  dimensionsEl.innerHTML = '';
  DIMENSIONS.forEach((dim, i) => {
    const rubric = DIMENSION_RUBRICS[dim];
    const div = document.createElement('div');
    div.className = 'review-dimension' + (i === 0 ? ' focused' : '');
    div.dataset.dim = dim;
    div.dataset.index = i;

    const info = document.createElement('div');
    info.className = 'review-dim-info';
    info.innerHTML = `<div class="review-dim-name">${rubric.name}</div>
      <div class="review-dim-rubric">${rubric.description}</div>`;

    const buttons = document.createElement('div');
    buttons.className = 'review-score-buttons';
    for (let s = 1; s <= 5; s++) {
      const btn = document.createElement('button');
      btn.className = 'review-score-btn';
      btn.textContent = s;
      btn.title = rubric.anchors[s];
      btn.dataset.score = s;
      btn.addEventListener('click', () => setScore(dim, s, i));
      buttons.appendChild(btn);
    }

    div.appendChild(info);
    div.appendChild(buttons);
    dimensionsEl.appendChild(div);
  });
}

function setScore(dim, score, dimIndex) {
  // Update button state
  const dimEl = dimensionsEl.children[dimIndex];
  dimEl.querySelectorAll('.review-score-btn').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.score) === score);
  });

  // Store on current sprite state
  if (!spriteScores[dim]) spriteScores[dim] = null;
  spriteScores[dim] = score;

  // Focus next dimension if not at last
  if (dimIndex < DIMENSIONS.length - 1) {
    setFocusedDimension(dimIndex + 1);
  }

  updateNextButton();
}

let spriteScores = {};

function resetSpriteScores() {
  spriteScores = {};
  DIMENSIONS.forEach(d => spriteScores[d] = null);
  dimensionsEl.querySelectorAll('.review-score-btn').forEach(btn => btn.classList.remove('selected'));
  setFocusedDimension(0);
  updateNextButton();
}

function setFocusedDimension(idx) {
  focusedDimIndex = Math.max(0, Math.min(idx, DIMENSIONS.length - 1));
  dimensionsEl.querySelectorAll('.review-dimension').forEach((el, i) => {
    el.classList.toggle('focused', i === focusedDimIndex);
  });
}

function updateNextButton() {
  const allScored = DIMENSIONS.every(d => spriteScores[d] != null);
  btnNext.disabled = !allScored;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

function showSprite(idx) {
  if (idx >= successResults.length) {
    finishGrading();
    return;
  }

  currentIndex = idx;
  const entry = successResults[idx];
  const result = entry.result;

  renderSprite(result.pixels, result.palette, canvas);

  promptText.textContent = result.prompt.prompt || result.prompt;
  if (result.prompt.hint) {
    qualityHint.textContent = `Hint: ${result.prompt.hint}`;
    qualityHint.style.display = '';
  } else {
    qualityHint.style.display = 'none';
  }

  if (result.stats) {
    statCoverage.textContent = `Coverage: ${result.stats.coveragePercent.toFixed(0)}%`;
    statCommands.textContent = `Commands: ${result.stats.commandCount}`;
    statPalette.textContent = `Palette: ${result.stats.paletteUtilization.toFixed(0)}%`;
  }

  progressEl.textContent = `Sprite ${idx + 1} of ${successResults.length}`;
  document.getElementById('sprite-notes').value = '';
  resetSpriteScores();
}

function nextSprite() {
  if (btnNext.disabled) return;

  // Record scores
  const overall = DIMENSIONS.reduce((sum, d) => sum + spriteScores[d], 0) / DIMENSIONS.length;
  const notes = document.getElementById('sprite-notes').value.trim();
  const humanScores = {
    componentSeparation: spriteScores.componentSeparation,
    colorUsage: spriteScores.colorUsage,
    detailDensity: spriteScores.detailDensity,
    spatialCoverage: spriteScores.spatialCoverage,
    promptAdherence: spriteScores.promptAdherence,
    overall: Math.round(overall * 10) / 10,
    timestamp: new Date().toISOString(),
  };
  if (notes) humanScores.notes = notes;
  collectedScores.push({
    index: successResults[currentIndex].originalIndex,
    humanScores,
  });

  showSprite(currentIndex + 1);
}

function skipSprite() {
  skippedCount++;
  showSprite(currentIndex + 1);
}

// ---------------------------------------------------------------------------
// Calibration summary
// ---------------------------------------------------------------------------

function finishGrading() {
  gradingInProgress = false;
  spriteView.style.display = 'none';
  summaryView.style.display = '';
  progressEl.textContent = 'Complete';

  computeAndShowCalibration();
  saveScores();
}

function computeAndShowCalibration() {
  const graded = collectedScores.length;
  const total = successResults.length;

  document.getElementById('summary-stats').textContent =
    `Graded: ${graded} | Skipped: ${skippedCount} | Total: ${total}`;

  // Compute per-dimension calibration
  const calibration = DIMENSIONS.map(dim => {
    let humanSum = 0, llmSum = 0, absSum = 0, agreeCount = 0, count = 0;

    for (const entry of collectedScores) {
      const result = currentReport.results[entry.index];
      if (!result.scores) continue;
      const humanScore = entry.humanScores[dim];
      const llmScore = result.scores[dim];
      if (humanScore == null || llmScore == null) continue;

      humanSum += humanScore;
      llmSum += llmScore;
      absSum += Math.abs(humanScore - llmScore);
      if (Math.abs(humanScore - llmScore) <= 1) agreeCount++;
      count++;
    }

    const humanAvg = count > 0 ? humanSum / count : 0;
    const llmAvg = count > 0 ? llmSum / count : 0;
    const mad = count > 0 ? absSum / count : 0;
    const agreementRate = count > 0 ? (agreeCount / count) * 100 : 0;

    return {
      dimension: dim,
      name: DIMENSION_RUBRICS[dim].name,
      humanAvg,
      llmAvg,
      meanAbsoluteDifference: mad,
      agreementRate,
      flagged: mad > 1.0,
    };
  });

  // Render calibration table
  const tbody = document.getElementById('calibration-body');
  tbody.innerHTML = '';
  for (const cal of calibration) {
    const tr = document.createElement('tr');
    if (cal.flagged) tr.className = 'flagged';
    tr.innerHTML = `
      <td>${cal.name}</td>
      <td>${cal.humanAvg.toFixed(1)}</td>
      <td>${cal.llmAvg.toFixed(1)}</td>
      <td>${cal.meanAbsoluteDifference.toFixed(2)}</td>
      <td>${cal.agreementRate.toFixed(0)}%</td>
    `;
    tbody.appendChild(tr);
  }

  // Per-sprite breakdown
  const breakdownEl = document.getElementById('sprite-breakdown');
  breakdownEl.innerHTML = '';

  for (const entry of collectedScores) {
    const result = currentReport.results[entry.index];
    const row = document.createElement('div');
    row.className = 'review-breakdown-row';

    // Thumbnail
    const thumbDiv = document.createElement('div');
    thumbDiv.className = 'review-breakdown-thumb';
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = 64;
    thumbCanvas.height = 64;
    renderSprite(result.pixels, result.palette, thumbCanvas);
    thumbDiv.appendChild(thumbCanvas);

    // Info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'review-breakdown-info';

    const promptDiv = document.createElement('div');
    promptDiv.className = 'review-breakdown-prompt';
    promptDiv.textContent = result.prompt.prompt || result.prompt;
    infoDiv.appendChild(promptDiv);

    const scoresDiv = document.createElement('div');
    scoresDiv.className = 'review-breakdown-scores';

    for (const dim of DIMENSIONS) {
      const humanS = entry.humanScores[dim];
      const llmS = result.scores ? result.scores[dim] : null;
      const divergent = llmS != null && Math.abs(humanS - llmS) > 1;

      const cell = document.createElement('div');
      cell.className = 'review-breakdown-dim' + (divergent ? ' divergent' : '');
      cell.innerHTML = `<div class="dim-label">${DIMENSION_RUBRICS[dim].name.split(' ')[0]}</div>
        <div>H:${humanS} L:${llmS != null ? llmS : '—'}</div>`;
      scoresDiv.appendChild(cell);
    }
    infoDiv.appendChild(scoresDiv);

    const notes = entry.humanScores.notes;
    if (notes) {
      const notesDiv = document.createElement('div');
      notesDiv.className = 'review-breakdown-notes';
      notesDiv.textContent = notes;
      infoDiv.appendChild(notesDiv);
    }

    row.appendChild(thumbDiv);
    row.appendChild(infoDiv);
    breakdownEl.appendChild(row);
  }
}

async function saveScores() {
  const statusEl = document.getElementById('save-status');
  if (collectedScores.length === 0) {
    statusEl.className = 'review-save-status';
    statusEl.textContent = 'No scores to save (all sprites were skipped).';
    return;
  }

  try {
    const result = await saveHumanScores(currentFilename, collectedScores);
    statusEl.className = 'review-save-status success';
    statusEl.textContent = `Saved ${result.saved} human scores to ${currentFilename}.`;
  } catch (err) {
    statusEl.className = 'review-save-status error';
    statusEl.innerHTML = `Error saving scores: ${err.message}`;
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', saveScores);
    statusEl.appendChild(retryBtn);
  }
}

// ---------------------------------------------------------------------------
// View results (for already-graded reports)
// ---------------------------------------------------------------------------

function viewExistingResults() {
  regradeBanner.style.display = 'none';
  spriteView.style.display = 'none';
  summaryView.style.display = '';
  progressEl.textContent = 'Complete';

  // Build collectedScores from existing humanScores
  collectedScores = [];
  skippedCount = 0;
  for (const entry of successResults) {
    const result = entry.result;
    if (result.humanScores) {
      collectedScores.push({
        index: entry.originalIndex,
        humanScores: result.humanScores,
      });
    } else {
      skippedCount++;
    }
  }

  computeAndShowCalibration();
  document.getElementById('save-status').textContent = 'Scores loaded from existing report.';
  document.getElementById('save-status').className = 'review-save-status success';
}

// ---------------------------------------------------------------------------
// Report loading
// ---------------------------------------------------------------------------

async function loadReport(filename) {
  currentFilename = filename;
  regradeBanner.style.display = 'none';
  spriteView.style.display = 'none';
  summaryView.style.display = 'none';
  emptyState.style.display = 'none';

  const report = await fetchReport(filename);
  currentReport = report;

  // Filter to successful results, keeping original index
  successResults = [];
  if (Array.isArray(report.results)) {
    report.results.forEach((r, i) => {
      if (r.status === 'success') {
        successResults.push({ result: r, originalIndex: i });
      }
    });
  }

  if (successResults.length === 0) {
    emptyState.style.display = '';
    emptyMessage.textContent = 'No successful sprites in this report.';
    return;
  }

  // Check for existing human scores
  const hasHumanScores = successResults.some(e => e.result.humanScores != null);
  if (hasHumanScores) {
    regradeBanner.style.display = '';
    return;
  }

  startGrading();
}

function startGrading() {
  regradeBanner.style.display = 'none';
  collectedScores = [];
  skippedCount = 0;
  currentIndex = 0;
  gradingInProgress = true;

  buildDimensionUI();
  spriteView.style.display = '';
  summaryView.style.display = 'none';

  showSprite(0);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function makeReportOption(r) {
  const opt = document.createElement('option');
  opt.value = r.filename;
  const ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
  const status = r.hasHumanScores ? ' [graded]' : '';
  const success = `${r.successCount}/${r.totalPrompts} ok`;
  opt.textContent = `${r.systemPromptVersion} — ${r.promptSetName} — ${ts} — ${success}${status}`;
  return opt;
}

async function init() {
  reportList = await fetchReports();

  reportSelect.innerHTML = '';
  if (reportList.length === 0) {
    emptyState.style.display = '';
    emptyMessage.textContent = 'No reports found — run node eval/run.js first';
    return;
  }

  const graded = reportList.filter(r => r.hasHumanScores);
  const ungraded = reportList.filter(r => !r.hasHumanScores);

  if (ungraded.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Ungraded';
    for (const r of ungraded) {
      group.appendChild(makeReportOption(r));
    }
    reportSelect.appendChild(group);
  }

  if (graded.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Previously Graded';
    for (const r of graded) {
      group.appendChild(makeReportOption(r));
    }
    reportSelect.appendChild(group);
  }

  reportSelect.addEventListener('change', () => {
    if (reportSelect.value) loadReport(reportSelect.value);
  });

  // Auto-select: prefer most recent ungraded, otherwise most recent overall
  const firstUngraded = reportList.find(r => !r.hasHumanScores);
  const toLoad = firstUngraded || reportList[0];
  reportSelect.value = toLoad.filename;
  loadReport(toLoad.filename);
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

btnNext.addEventListener('click', nextSprite);
btnSkip.addEventListener('click', skipSprite);
btnFinish.addEventListener('click', finishGrading);
btnViewResults.addEventListener('click', viewExistingResults);
btnRegrade.addEventListener('click', startGrading);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Only handle shortcuts when grading view is visible
  if (spriteView.style.display === 'none') return;

  // 1-5: set score for focused dimension
  if (e.key >= '1' && e.key <= '5' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    const score = parseInt(e.key);
    const dim = DIMENSIONS[focusedDimIndex];
    setScore(dim, score, focusedDimIndex);
    return;
  }

  // Tab: move between dimensions
  if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      setFocusedDimension(focusedDimIndex - 1);
    } else {
      setFocusedDimension(focusedDimIndex + 1);
    }
    return;
  }

  // Enter: next sprite
  if (e.key === 'Enter') {
    e.preventDefault();
    nextSprite();
    return;
  }

  // Escape: skip
  if (e.key === 'Escape') {
    e.preventDefault();
    skipSprite();
    return;
  }
});

// Warn on navigation while grading
window.addEventListener('beforeunload', (e) => {
  if (gradingInProgress && collectedScores.length > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

init();
