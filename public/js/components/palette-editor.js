// Asset Forge — Palette Editor Component (T020)
// Displays and edits the project color palette; supports LLM-based generation.

(function () {
  'use strict';

  // Transient state for generated-but-not-yet-applied palette
  var pendingPalette = null;

  /**
   * Render the palette editor into the given container for the given project.
   */
  function render(container, project) {
    pendingPalette = null;
    var palette = project.palette || [];

    container.innerHTML =
      '<div class="section-header">' +
        '<h2 class="section-title">Palette</h2>' +
      '</div>' +

      // Current palette
      '<div class="card mb-lg">' +
        '<h3 class="card-title mb-md">Current Palette</h3>' +
        buildSwatchGrid(palette, 'pe-current') +
      '</div>' +

      // Hidden color picker for editing individual swatches
      '<input type="color" id="pe-color-picker" style="position:absolute;visibility:hidden;">' +

      // LLM generation section
      '<div class="card mb-lg">' +
        '<h3 class="card-title mb-md">Generate Palette with AI</h3>' +
        '<form id="pe-gen-form">' +
          '<div class="form-row">' +
            '<div class="form-group">' +
              '<label class="form-label" for="pe-gen-prompt">Theme Prompt</label>' +
              '<input class="form-input" type="text" id="pe-gen-prompt" ' +
                'placeholder="military desert colors">' +
            '</div>' +
            '<div>' +
              '<button class="btn btn-secondary" type="submit" id="pe-gen-btn">' +
                'Generate Palette' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</form>' +

        // Preview area (hidden until generation completes)
        '<div id="pe-preview-area" style="display:none;" class="mt-lg">' +
          '<h4 class="mb-md">Preview</h4>' +
          '<div id="pe-preview-swatches"></div>' +
          '<div class="flex gap-sm mt-md">' +
            '<button class="btn btn-primary" id="pe-apply-btn">Apply</button>' +
            '<button class="btn btn-ghost" id="pe-discard-btn">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // --- Swatch click → color picker ---
    attachSwatchEditing(container, project);

    // --- Generate form ---
    attachGenerateHandler(container, project);
  }

  // ---------------------------------------------------------------------------
  // Build a swatch grid from a palette array of {r,g,b} objects
  // ---------------------------------------------------------------------------

  function buildSwatchGrid(palette, idPrefix) {
    if (!palette || palette.length === 0) {
      return '<p class="text-muted">No palette defined yet. Generate one below!</p>';
    }

    var html = '<div class="palette-grid">';
    for (var i = 0; i < palette.length; i++) {
      var color = palette[i];
      var hexColor = rgbToHex(color.r, color.g, color.b);
      var isTransparent = i === 0;

      var swatchClasses = 'palette-swatch palette-swatch-large';
      if (isTransparent) swatchClasses += ' transparent';

      var bgStyle = isTransparent ? '' : 'background-color:' + hexColor + ';';

      html +=
        '<div class="' + swatchClasses + '" ' +
          'style="' + bgStyle + '" ' +
          'data-swatch-index="' + i + '" ' +
          'data-prefix="' + idPrefix + '" ' +
          'title="Index ' + i + (isTransparent ? ' (Transparent)' : ': ' + hexColor) + '">' +
          '<span class="palette-index">' +
            (isTransparent ? 'T' : i) +
          '</span>' +
        '</div>';
    }
    html += '</div>';
    return html;
  }

  // ---------------------------------------------------------------------------
  // Swatch editing — click to open native color picker
  // ---------------------------------------------------------------------------

  function attachSwatchEditing(container, project) {
    var picker = document.getElementById('pe-color-picker');
    var currentSwatches = container.querySelectorAll('[data-prefix="pe-current"]');

    currentSwatches.forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        var idx = parseInt(swatch.dataset.swatchIndex, 10);

        // Index 0 is transparent — don't allow editing
        if (idx === 0) {
          App.showToast('Index 0 is reserved for transparency.', 'info');
          return;
        }

        var color = project.palette[idx];
        if (!color) return;

        picker.value = rgbToHex(color.r, color.g, color.b);

        // Position picker near the swatch so the browser popup is contextual
        var rect = swatch.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.left = rect.left + 'px';
        picker.style.top = rect.bottom + 'px';
        picker.style.visibility = 'visible';
        picker.focus();
        picker.click();

        // One-time change handler
        function onChange() {
          picker.removeEventListener('change', onChange);
          picker.style.visibility = 'hidden';

          var newRgb = hexToRgb(picker.value);
          var updatedPalette = project.palette.map(function (c) {
            return { r: c.r, g: c.g, b: c.b };
          });
          updatedPalette[idx] = newRgb;

          savePalette(project, updatedPalette, container);
        }

        // Remove any previous listener, then add fresh one
        picker.removeEventListener('change', onChange);
        picker.addEventListener('change', onChange);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // LLM palette generation
  // ---------------------------------------------------------------------------

  function attachGenerateHandler(container, project) {
    var form = document.getElementById('pe-gen-form');
    var genBtn = document.getElementById('pe-gen-btn');
    var previewArea = document.getElementById('pe-preview-area');
    var previewSwatches = document.getElementById('pe-preview-swatches');
    var applyBtn = document.getElementById('pe-apply-btn');
    var discardBtn = document.getElementById('pe-discard-btn');

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var promptInput = document.getElementById('pe-gen-prompt');
      var prompt = promptInput.value.trim();
      if (!prompt) {
        App.showToast('Enter a theme prompt (e.g. "underwater ocean theme").', 'warning');
        promptInput.focus();
        return;
      }

      genBtn.disabled = true;
      genBtn.textContent = 'Generating...';

      try {
        var result = await API.generatePalette(project.id, prompt);
        pendingPalette = result.palette || result;

        // Show preview
        previewSwatches.innerHTML = buildSwatchGrid(
          Array.isArray(pendingPalette) ? pendingPalette : [],
          'pe-preview'
        );
        previewArea.style.display = '';
        App.showToast('Palette generated! Review the preview below.', 'success');
      } catch (err) {
        App.showToast('Generation failed: ' + err.message, 'error');
      } finally {
        genBtn.disabled = false;
        genBtn.textContent = 'Generate Palette';
      }
    });

    // Apply generated palette
    applyBtn.addEventListener('click', function () {
      if (!pendingPalette) return;
      savePalette(project, pendingPalette, container);
    });

    // Discard preview
    discardBtn.addEventListener('click', function () {
      pendingPalette = null;
      previewArea.style.display = 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // Save palette via API, then re-render
  // ---------------------------------------------------------------------------

  async function savePalette(project, palette, container) {
    try {
      var updated = await API.updatePalette(project.id, palette);
      // Merge updated palette back into the project object
      project.palette = updated.palette || palette;
      App.updateProject(project);
      App.showToast('Palette saved!', 'success');
      render(container, project);
    } catch (err) {
      App.showToast('Failed to save palette: ' + err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Color conversion helpers
  // ---------------------------------------------------------------------------

  function rgbToHex(r, g, b) {
    return (
      '#' +
      ('0' + (r & 0xff).toString(16)).slice(-2) +
      ('0' + (g & 0xff).toString(16)).slice(-2) +
      ('0' + (b & 0xff).toString(16)).slice(-2)
    );
  }

  function hexToRgb(hex) {
    hex = hex.replace(/^#/, '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.PaletteEditor = { render: render };
})();
