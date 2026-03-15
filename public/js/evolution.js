'use strict';

const DIMENSIONS = ['componentSeparation', 'colorUsage', 'detailDensity', 'spatialCoverage', 'pixelArtDiscipline', 'promptAdherence'];
const DIM_NAMES = {
  componentSeparation: 'Component Separation',
  colorUsage: 'Color Usage',
  detailDensity: 'Detail Density',
  spatialCoverage: 'Spatial Coverage',
  pixelArtDiscipline: 'Pixel Art Discipline',
  promptAdherence: 'Prompt Adherence',
};

function getPixelScale(width, height) {
  return Math.min(4, Math.floor(200 / Math.max(width, height)));
}

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

function renderSprite(pixels, palette, canvasEl) {
  if (!pixels || !palette) return;
  const height = pixels.length;
  const width = pixels[0].length;
  const scale = getPixelScale(width, height);
  canvasEl.width = width * scale;
  canvasEl.height = height * scale;
  const c = canvasEl.getContext('2d');
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y][x];
      if (idx === 0) continue;
      const color = palette[idx];
      if (!color) continue;
      c.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      c.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function computeAverages(report) {
  const avgs = {};
  const successful = report.results.filter(r => r.status === 'success' && r.scores);
  if (successful.length === 0) return null;

  for (const dim of DIMENSIONS) {
    avgs[dim] = successful.reduce((sum, r) => sum + (r.scores[dim] || 0), 0) / successful.length;
  }
  avgs.overall = DIMENSIONS.reduce((sum, d) => sum + avgs[d], 0) / DIMENSIONS.length;
  avgs.count = successful.length;
  avgs.total = report.results.length;
  return avgs;
}

async function init() {
  const reportList = await fetchReports();
  const statusEl = document.getElementById('evo-status');

  // Group reports by systemPromptVersion
  const byVersion = {};
  for (const meta of reportList) {
    const ver = meta.systemPromptVersion || 'unknown';
    if (!byVersion[ver]) byVersion[ver] = [];
    byVersion[ver].push(meta);
  }

  const versions = Object.keys(byVersion);

  if (versions.length <= 1) {
    // Only one version exists — show waiting state
    statusEl.className = 'evo-status-banner waiting';
    statusEl.innerHTML = `
      <h4>Waiting for generator prompt iteration</h4>
      <p>This page will show sprite quality evolution once you start testing different generator prompts.
      Right now all reports use the same system prompt version (<strong>${versions[0] || 'current'}</strong>).
      The <a href="/comparison.html">calibration page</a> tracks judge accuracy — that's the current phase.</p>
      <p style="margin-top: var(--space-sm);">To start iterating:</p>
      <ol style="margin-top: var(--space-xs); padding-left: var(--space-lg);">
        <li>Create a new prompt version: <code>eval/system-prompts/v2.js</code></li>
        <li>Run: <code>node eval/run.js --system-prompt v2</code></li>
        <li>The calibrated judge will score both versions — results appear here</li>
      </ol>
    `;

    document.getElementById('evo-trends-container').innerHTML =
      '<p class="text-muted text-center" style="padding: var(--space-xl);">No data yet — only one prompt version exists.</p>';
    document.getElementById('evo-sprites-container').innerHTML = '';
    return;
  }

  // We have multiple versions — show the evolution
  statusEl.className = 'evo-status-banner ready';
  statusEl.innerHTML = `
    <h4>Tracking ${versions.length} prompt versions</h4>
    <p>Comparing: ${versions.map(v => '<strong>' + v + '</strong>').join(' → ')}</p>
  `;

  // Load the most recent report for each version
  const versionReports = [];
  for (const ver of versions) {
    const most_recent = byVersion[ver][0]; // already sorted by timestamp desc
    const report = await fetchReport(most_recent.filename);
    report._version = ver;
    report._filename = most_recent.filename;
    versionReports.push(report);
  }

  // Sort by timestamp (oldest first)
  versionReports.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));

  // Build trends table
  buildTrendsTable(versionReports);

  // Build side-by-side sprites
  buildSpriteComparison(versionReports);
}

function buildTrendsTable(reports) {
  const container = document.getElementById('evo-trends-container');
  const averages = reports.map(r => computeAverages(r));

  const table = document.createElement('table');
  table.className = 'evo-trends-table';

  // Header
  const thead = document.createElement('thead');
  let headerRow = '<tr><th>Dimension</th>';
  reports.forEach((r, i) => {
    const isBaseline = i === 0;
    const tag = isBaseline ? 'baseline' : '';
    headerRow += `<th><span class="evo-version-tag ${tag}">${r._version}</span><br>${new Date(r.timestamp).toLocaleDateString()}<br><span style="font-weight:400;font-size:0.65rem">${averages[i] ? averages[i].count + '/' + averages[i].total + ' sprites' : '—'}</span></th>`;
  });
  headerRow += '</tr>';
  thead.innerHTML = headerRow;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  const allDims = [...DIMENSIONS, 'overall'];

  for (const dim of allDims) {
    const tr = document.createElement('tr');
    if (dim === 'overall') tr.className = 'overall-row';

    const dimName = dim === 'overall' ? 'OVERALL' : DIM_NAMES[dim];
    let cells = `<td>${dimName}</td>`;

    for (let i = 0; i < reports.length; i++) {
      const avg = averages[i];
      if (!avg) {
        cells += '<td>—</td>';
        continue;
      }

      const score = avg[dim];
      const prev = i > 0 && averages[i - 1] ? averages[i - 1][dim] : null;
      let cls = '';
      let arrow = '';

      if (prev != null) {
        const diff = score - prev;
        if (diff > 0.2) { cls = 'improved'; arrow = ' ↑'; }
        else if (diff < -0.2) { cls = 'worsened'; arrow = ' ↓'; }
      }

      cells += `<td class="${cls}">${score.toFixed(1)}/5${arrow}</td>`;
    }

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  container.appendChild(table);
}

function buildSpriteComparison(reports) {
  const container = document.getElementById('evo-sprites-container');

  // Get unique prompts from the report with the most results
  const longestReport = reports.reduce((a, b) => a.results.length >= b.results.length ? a : b);
  const prompts = longestReport.results.map((r, i) => ({
    text: r.prompt.prompt,
    category: r.prompt.category || '',
    index: i,
  }));

  for (const prompt of prompts) {
    const row = document.createElement('div');
    row.className = 'comp-prompt-row';

    const header = document.createElement('div');
    header.className = 'comp-prompt-header';
    header.innerHTML = `
      <span class="comp-prompt-text">${prompt.text}</span>
      ${prompt.category ? `<span class="comp-prompt-category">${prompt.category}</span>` : ''}
    `;
    row.appendChild(header);

    const roundsDiv = document.createElement('div');
    roundsDiv.className = 'comp-rounds';

    for (const report of reports) {
      // Find matching result by prompt text
      const result = report.results.find(r => r.prompt.prompt === prompt.text);

      const roundDiv = document.createElement('div');
      roundDiv.className = 'comp-round';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'comp-round-label';
      const isBaseline = report === reports[0];
      labelDiv.innerHTML = `<span class="evo-version-tag ${isBaseline ? 'baseline' : ''}">${report._version}</span>`;
      roundDiv.appendChild(labelDiv);

      if (result && result.status === 'success' && result.pixels) {
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'comp-canvas-wrapper';
        const canvas = document.createElement('canvas');
        renderSprite(result.pixels, result.palette, canvas);
        canvasWrap.appendChild(canvas);
        roundDiv.appendChild(canvasWrap);

        // Show scores — human (H:) and LLM (L:) when available
        if (result.scores || result.humanScores) {
          const scoresDiv = document.createElement('div');
          scoresDiv.className = 'comp-scores';
          for (const dim of DIMENSIONS) {
            const h = result.humanScores ? result.humanScores[dim] : null;
            const l = result.scores ? result.scores[dim] : null;
            const divergent = h != null && l != null && Math.abs(h - l) > 1;
            const scoreRow = document.createElement('div');
            scoreRow.className = 'comp-score-row' + (divergent ? ' divergent' : '');
            scoreRow.innerHTML = `
              <span class="comp-score-dim">${DIM_NAMES[dim].split(' ')[0]}</span>
              <span class="comp-score-values">
                <span class="comp-score-human">${h != null ? 'H:' + h : ''}</span>
                <span class="comp-score-llm">${l != null ? 'L:' + l : ''}</span>
              </span>
            `;
            scoresDiv.appendChild(scoreRow);
          }
          // Overall
          const overallL = result.scores ? DIMENSIONS.reduce((s, d) => s + (result.scores[d] || 0), 0) / DIMENSIONS.length : null;
          const overallH = result.humanScores ? DIMENSIONS.reduce((s, d) => s + (result.humanScores[d] || 0), 0) / DIMENSIONS.length : null;
          const overallRow = document.createElement('div');
          overallRow.className = 'comp-score-row';
          overallRow.style.fontWeight = '700';
          overallRow.innerHTML = `
            <span class="comp-score-dim">Overall</span>
            <span class="comp-score-values">
              <span class="comp-score-human">${overallH != null ? 'H:' + overallH.toFixed(1) : ''}</span>
              <span class="comp-score-llm">${overallL != null ? 'L:' + overallL.toFixed(1) : ''}</span>
            </span>
          `;
          scoresDiv.appendChild(overallRow);
          roundDiv.appendChild(scoresDiv);
        }
      } else {
        const noData = document.createElement('div');
        noData.className = 'comp-no-data';
        noData.textContent = result ? 'Generation failed' : 'Prompt not in this version';
        roundDiv.appendChild(noData);
      }

      roundsDiv.appendChild(roundDiv);
    }

    row.appendChild(roundsDiv);
    container.appendChild(row);
  }
}

init();
