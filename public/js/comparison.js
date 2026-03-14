'use strict';

const DIMENSIONS = ['componentSeparation', 'colorUsage', 'detailDensity', 'spatialCoverage', 'promptAdherence'];
const DIM_NAMES = {
  componentSeparation: 'Comp Sep',
  colorUsage: 'Color',
  detailDensity: 'Detail',
  spatialCoverage: 'Spatial',
  promptAdherence: 'Prompt',
};
const PIXEL_SCALE = 4;

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
  canvasEl.width = width * PIXEL_SCALE;
  canvasEl.height = height * PIXEL_SCALE;
  const c = canvasEl.getContext('2d');
  c.clearRect(0, 0, canvasEl.width, canvasEl.height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = pixels[y][x];
      if (idx === 0) continue;
      const color = palette[idx];
      if (!color) continue;
      c.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      c.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
    }
  }
}

function computeCalibration(report) {
  const cal = {};
  for (const dim of DIMENSIONS) {
    let hSum = 0, lSum = 0, absSum = 0, agree = 0, n = 0;
    for (const r of report.results) {
      if (r.status !== 'success' || !r.humanScores || !r.scores) continue;
      const h = r.humanScores[dim], l = r.scores[dim];
      if (h == null || l == null) continue;
      hSum += h; lSum += l; absSum += Math.abs(h - l);
      if (Math.abs(h - l) <= 1) agree++;
      n++;
    }
    cal[dim] = {
      humanAvg: n > 0 ? hSum / n : null,
      llmAvg: n > 0 ? lSum / n : null,
      mad: n > 0 ? absSum / n : null,
      agreement: n > 0 ? (agree / n) * 100 : null,
      count: n,
    };
  }
  return cal;
}

function roundLabel(report, index) {
  const hasHuman = report.results.some(r => r.humanScores);
  const judge = report.judgingModel || 'unknown';
  const shortJudge = judge.includes('opus') ? 'Opus' : judge.includes('sonnet') ? 'Sonnet' : judge;
  return {
    label: `Round ${index + 1}`,
    meta: `Judge: ${shortJudge} | ${hasHuman ? 'Human graded' : 'Not graded'}`,
    timestamp: new Date(report.timestamp).toLocaleDateString(),
  };
}

async function init() {
  const reportList = await fetchReports();
  if (reportList.length === 0) {
    document.getElementById('comparison-container').innerHTML =
      '<div class="empty-state"><div class="empty-state-title">No reports found</div></div>';
    return;
  }

  // Load all reports (sorted oldest first for chronological display)
  const reports = [];
  for (const meta of reportList.reverse()) {
    const report = await fetchReport(meta.filename);
    report._filename = meta.filename;
    reports.push(report);
  }

  const container = document.getElementById('comparison-container');

  // Get prompt list from first report
  const prompts = reports[0].results.map((r, i) => ({
    text: r.prompt.prompt,
    category: r.prompt.category || '',
    index: i,
  }));

  // Build comparison rows
  for (const prompt of prompts) {
    const row = document.createElement('div');
    row.className = 'comp-prompt-row';

    // Header
    const header = document.createElement('div');
    header.className = 'comp-prompt-header';
    header.innerHTML = `
      <span class="comp-prompt-text">${prompt.text}</span>
      ${prompt.category ? `<span class="comp-prompt-category">${prompt.category}</span>` : ''}
    `;
    row.appendChild(header);

    // Rounds
    const roundsDiv = document.createElement('div');
    roundsDiv.className = 'comp-rounds';

    for (let ri = 0; ri < reports.length; ri++) {
      const report = reports[ri];
      const result = report.results[prompt.index];
      const info = roundLabel(report, ri);

      const roundDiv = document.createElement('div');
      roundDiv.className = 'comp-round';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'comp-round-label';
      labelDiv.textContent = `${info.label} — ${info.timestamp}`;
      roundDiv.appendChild(labelDiv);

      const metaDiv = document.createElement('div');
      metaDiv.className = 'comp-round-meta';
      metaDiv.textContent = info.meta;
      roundDiv.appendChild(metaDiv);

      if (result && result.status === 'success' && result.pixels) {
        // Canvas
        const canvasWrap = document.createElement('div');
        canvasWrap.className = 'comp-canvas-wrapper';
        const canvas = document.createElement('canvas');
        renderSprite(result.pixels, result.palette, canvas);
        canvasWrap.appendChild(canvas);
        roundDiv.appendChild(canvasWrap);

        // Scores
        const scoresDiv = document.createElement('div');
        scoresDiv.className = 'comp-scores';

        for (const dim of DIMENSIONS) {
          const h = result.humanScores ? result.humanScores[dim] : null;
          const l = result.scores ? result.scores[dim] : null;
          const divergent = h != null && l != null && Math.abs(h - l) > 1;

          const scoreRow = document.createElement('div');
          scoreRow.className = 'comp-score-row' + (divergent ? ' divergent' : '');
          scoreRow.innerHTML = `
            <span class="comp-score-dim">${DIM_NAMES[dim]}</span>
            <span class="comp-score-values">
              <span class="comp-score-human">${h != null ? 'H:' + h : ''}</span>
              <span class="comp-score-llm">${l != null ? 'L:' + l : ''}</span>
            </span>
          `;
          scoresDiv.appendChild(scoreRow);
        }
        roundDiv.appendChild(scoresDiv);

        // Notes
        if (result.humanScores && result.humanScores.notes) {
          const notesDiv = document.createElement('div');
          notesDiv.className = 'comp-notes';
          notesDiv.textContent = result.humanScores.notes;
          roundDiv.appendChild(notesDiv);
        }
      } else {
        const noData = document.createElement('div');
        noData.className = 'comp-no-data';
        noData.textContent = result ? 'Generation failed' : 'No data';
        roundDiv.appendChild(noData);
      }

      roundsDiv.appendChild(roundDiv);
    }

    row.appendChild(roundsDiv);
    container.appendChild(row);
  }

  // Calibration evolution table
  buildCalibrationTable(reports);
}

function buildCalibrationTable(reports) {
  const tableContainer = document.getElementById('calibration-table-container');

  // Only include reports with human scores
  const gradedReports = reports.filter(r => r.results.some(res => res.humanScores));
  if (gradedReports.length === 0) {
    tableContainer.innerHTML = '<p class="text-muted">No graded reports yet.</p>';
    return;
  }

  const calibrations = gradedReports.map(r => computeCalibration(r));

  const table = document.createElement('table');
  table.className = 'comp-cal-table';

  // Header
  const thead = document.createElement('thead');
  let headerRow = '<tr><th>Dimension</th>';
  gradedReports.forEach((r, i) => {
    const judge = (r.judgingModel || '').includes('opus') ? 'Opus' : 'Sonnet';
    headerRow += `<th>Round ${i + 1} MAD<br><span style="font-weight:400;text-transform:none">${judge} judge</span></th>`;
    headerRow += `<th>Round ${i + 1} Agree</th>`;
  });
  headerRow += '</tr>';
  thead.innerHTML = headerRow;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  for (const dim of DIMENSIONS) {
    const tr = document.createElement('tr');
    let cells = `<td>${DIM_NAMES[dim]}</td>`;

    for (let i = 0; i < calibrations.length; i++) {
      const cal = calibrations[i][dim];
      const prevCal = i > 0 ? calibrations[i - 1][dim] : null;

      if (cal.mad != null) {
        let madClass = '';
        if (cal.mad > 1.0) madClass = 'flagged';
        if (prevCal && prevCal.mad != null) {
          if (cal.mad < prevCal.mad - 0.1) madClass += ' improved';
          else if (cal.mad > prevCal.mad + 0.1) madClass += ' worsened';
        }
        cells += `<td class="${madClass}">${cal.mad.toFixed(2)}</td>`;
        cells += `<td>${cal.agreement.toFixed(0)}%</td>`;
      } else {
        cells += '<td>—</td><td>—</td>';
      }
    }

    tr.innerHTML = cells;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

init();
