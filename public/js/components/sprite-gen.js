// Sprite Generation UI Component
// Provides the "Generate" tab for creating new sprites via LLM.

(function () {
  'use strict';

  var elapsedTimer = null;
  var generatedData = null;
  var generating = false;

  function render(container, project, parentSprite) {
    stopTimer();
    container.innerHTML = '';

    var wrap = document.createElement('div');
    wrap.className = 'sprite-gen';

    // -- Variation banner --
    if (parentSprite) {
      var banner = document.createElement('div');
      banner.className = 'sprite-gen-variation-banner';
      var bannerThumb = document.createElement('canvas');
      bannerThumb.className = 'sprite-gen-variation-thumb';
      window.GridRenderer.drawThumbnail(bannerThumb, parentSprite.pixels, parentSprite.palette, 48);
      banner.appendChild(bannerThumb);
      var bannerText = document.createElement('div');
      bannerText.innerHTML = '<strong>Creating variation</strong><br>Based on: ' +
        window.App.escapeHtml(parentSprite.name || 'Untitled');
      banner.appendChild(bannerText);
      var cancelVar = document.createElement('button');
      cancelVar.className = 'btn btn-ghost btn-small';
      cancelVar.textContent = 'Cancel';
      cancelVar.addEventListener('click', function() {
        window.App.clearParentSprite();
        render(container, project, null);
      });
      banner.appendChild(cancelVar);
      wrap.appendChild(banner);
    }

    // -- Input section --
    var inputSection = document.createElement('div');
    inputSection.className = 'sprite-gen-inputs';

    // Prompt
    var promptGroup = document.createElement('div');
    promptGroup.className = 'form-group';
    var promptLabel = document.createElement('label');
    promptLabel.className = 'form-label';
    promptLabel.textContent = 'Prompt';
    promptGroup.appendChild(promptLabel);
    var promptArea = document.createElement('textarea');
    promptArea.className = 'form-textarea';
    promptArea.placeholder = 'draw a top-down yellow tank with a big gun';
    promptArea.rows = 4;
    promptGroup.appendChild(promptArea);
    inputSection.appendChild(promptGroup);

    // Dimensions row
    var dimRow = document.createElement('div');
    dimRow.className = 'sprite-gen-options-row';

    var widthGroup = document.createElement('div');
    widthGroup.className = 'form-group';
    var widthLabel = document.createElement('label');
    widthLabel.className = 'form-label';
    widthLabel.textContent = 'Width';
    widthGroup.appendChild(widthLabel);
    var widthInput = document.createElement('input');
    widthInput.type = 'number';
    widthInput.className = 'form-input sprite-gen-width';
    widthInput.value = '64';
    widthInput.min = '1';
    widthInput.max = '512';
    widthGroup.appendChild(widthInput);
    dimRow.appendChild(widthGroup);

    var heightGroup = document.createElement('div');
    heightGroup.className = 'form-group';
    var heightLabel = document.createElement('label');
    heightLabel.className = 'form-label';
    heightLabel.textContent = 'Height';
    heightGroup.appendChild(heightLabel);
    var heightInput = document.createElement('input');
    heightInput.type = 'number';
    heightInput.className = 'form-input sprite-gen-height';
    heightInput.value = '64';
    heightInput.min = '1';
    heightInput.max = '512';
    heightGroup.appendChild(heightInput);
    dimRow.appendChild(heightGroup);

    var freeGroup = document.createElement('div');
    freeGroup.className = 'form-group';
    var freeLabel = document.createElement('label');
    freeLabel.className = 'form-label';
    freeLabel.innerHTML = '&nbsp;';
    freeGroup.appendChild(freeLabel);
    var freeCheckWrap = document.createElement('label');
    freeCheckWrap.className = 'form-check';
    var freeCb = document.createElement('input');
    freeCb.type = 'checkbox';
    freeCb.className = 'sprite-gen-free-colors';
    freeCheckWrap.appendChild(freeCb);
    freeCheckWrap.appendChild(document.createTextNode(' Use free colors'));
    freeGroup.appendChild(freeCheckWrap);
    dimRow.appendChild(freeGroup);

    inputSection.appendChild(dimRow);

    // Generate button
    var btnRow = document.createElement('div');
    btnRow.className = 'sprite-gen-btn-row';
    var genBtn = document.createElement('button');
    genBtn.className = 'btn btn-primary btn-large';
    genBtn.textContent = 'Generate Sprite';
    btnRow.appendChild(genBtn);
    inputSection.appendChild(btnRow);

    wrap.appendChild(inputSection);

    // -- Status area --
    var statusArea = document.createElement('div');
    statusArea.className = 'sprite-gen-status';
    wrap.appendChild(statusArea);

    // -- Result area --
    var resultArea = document.createElement('div');
    resultArea.className = 'sprite-gen-result';
    wrap.appendChild(resultArea);

    container.appendChild(wrap);

    // Restore previous result
    if (generatedData && !generating) {
      renderResult(resultArea, project, parentSprite);
    }

    // -- Generate handler --
    genBtn.addEventListener('click', function () {
      if (generating) return;

      var prompt = promptArea.value.trim();
      if (!prompt) {
        window.App.showToast('Please enter a prompt.', 'error');
        return;
      }

      var width = parseInt(widthInput.value, 10) || 64;
      var height = parseInt(heightInput.value, 10) || 64;
      var useProjectPalette = !freeCb.checked;

      generating = true;
      generatedData = null;
      resultArea.innerHTML = '';

      var startTime = Date.now();
      statusArea.innerHTML =
        '<div class="sprite-gen-loading">' +
        '<div class="spinner"></div>' +
        '<span>Generating sprite\u2026 <strong class="sprite-gen-elapsed">0s</strong></span>' +
        '</div>';
      var elapsedSpan = statusArea.querySelector('.sprite-gen-elapsed');
      elapsedTimer = setInterval(function () {
        elapsedSpan.textContent = Math.floor((Date.now() - startTime) / 1000) + 's';
      }, 1000);

      genBtn.disabled = true;
      genBtn.textContent = 'Generating\u2026';

      var parentId = parentSprite ? parentSprite.id : undefined;

      window.API.generateSprite(project.id, prompt, width, height, useProjectPalette, parentId)
        .then(function (result) {
          stopTimer();
          generating = false;
          genBtn.disabled = false;
          genBtn.textContent = 'Generate Sprite';
          statusArea.innerHTML = '';

          generatedData = {
            pixels: result.pixels,
            palette: result.palette,
            commands: result.commands,
            warnings: result.warnings || [],
            prompt: prompt,
            width: width,
            height: height,
          };

          renderResult(resultArea, project, parentSprite);
        })
        .catch(function (err) {
          stopTimer();
          generating = false;
          genBtn.disabled = false;
          genBtn.textContent = 'Generate Sprite';
          statusArea.innerHTML =
            '<div class="sprite-gen-error">' +
            '<p>' + window.App.escapeHtml(err.message || 'Generation failed') + '</p>' +
            '<button class="btn btn-secondary" id="sprite-gen-retry">Try Again</button>' +
            '</div>';
          document.getElementById('sprite-gen-retry').addEventListener('click', function() {
            statusArea.innerHTML = '';
            genBtn.click();
          });
        });
    });
  }

  function renderResult(resultArea, project, parentSprite) {
    if (!generatedData) return;
    resultArea.innerHTML = '';

    var data = generatedData;
    var currentZoom = 5;
    var showGrid = false;

    // -- Preview section (two-column: canvas + controls) --
    var previewSection = document.createElement('div');
    previewSection.className = 'sprite-gen-preview';

    // Canvas area
    var canvasArea = document.createElement('div');
    canvasArea.className = 'sprite-gen-canvas-area';

    if (parentSprite) {
      // Side-by-side layout
      var sideBySide = document.createElement('div');
      sideBySide.className = 'sprite-gen-side-by-side';

      var origBlock = document.createElement('div');
      origBlock.className = 'sprite-gen-compare-block';
      origBlock.innerHTML = '<div class="sprite-gen-compare-label">Original</div>';
      var origCanvas = document.createElement('canvas');
      origCanvas.className = 'sprite-gen-canvas';
      window.GridRenderer.drawSprite(origCanvas, parentSprite.pixels, parentSprite.palette, currentZoom);
      origBlock.appendChild(origCanvas);
      sideBySide.appendChild(origBlock);

      var newBlock = document.createElement('div');
      newBlock.className = 'sprite-gen-compare-block';
      newBlock.innerHTML = '<div class="sprite-gen-compare-label">New Variation</div>';
      var canvas = document.createElement('canvas');
      canvas.className = 'sprite-gen-canvas';
      window.GridRenderer.drawSprite(canvas, data.pixels, data.palette, currentZoom);
      newBlock.appendChild(canvas);
      sideBySide.appendChild(newBlock);

      canvasArea.appendChild(sideBySide);
    } else {
      var canvas = document.createElement('canvas');
      canvas.className = 'sprite-gen-canvas';
      window.GridRenderer.drawSprite(canvas, data.pixels, data.palette, currentZoom);
      canvasArea.appendChild(canvas);
    }

    previewSection.appendChild(canvasArea);

    // Controls sidebar
    var controls = document.createElement('div');
    controls.className = 'sprite-gen-controls';

    // Zoom
    var zoomGroup = document.createElement('div');
    zoomGroup.className = 'form-group';
    var zoomLabel = document.createElement('label');
    zoomLabel.className = 'form-label';
    zoomLabel.textContent = 'Zoom';
    zoomGroup.appendChild(zoomLabel);
    var zoomRow = document.createElement('div');
    zoomRow.className = 'sprite-gen-zoom-row';
    var zoomSlider = document.createElement('input');
    zoomSlider.type = 'range';
    zoomSlider.className = 'form-input';
    zoomSlider.min = '2';
    zoomSlider.max = '8';
    zoomSlider.value = String(currentZoom);
    var zoomVal = document.createElement('span');
    zoomVal.className = 'sprite-gen-zoom-val';
    zoomVal.textContent = currentZoom + 'x';
    zoomRow.appendChild(zoomSlider);
    zoomRow.appendChild(zoomVal);
    zoomGroup.appendChild(zoomRow);
    controls.appendChild(zoomGroup);

    // Grid overlay
    var gridGroup = document.createElement('div');
    gridGroup.className = 'form-group';
    var gridCheck = document.createElement('label');
    gridCheck.className = 'form-check';
    var gridCb = document.createElement('input');
    gridCb.type = 'checkbox';
    gridCheck.appendChild(gridCb);
    gridCheck.appendChild(document.createTextNode(' Grid overlay'));
    gridGroup.appendChild(gridCheck);
    controls.appendChild(gridGroup);

    // Warnings
    if (data.warnings && data.warnings.length > 0) {
      var warnGroup = document.createElement('div');
      warnGroup.className = 'sprite-gen-warnings';
      warnGroup.innerHTML =
        '<div class="sprite-gen-warn-badge">' + data.warnings.length + ' command' +
        (data.warnings.length === 1 ? '' : 's') + ' skipped</div>';
      controls.appendChild(warnGroup);
    }

    // Save section
    var saveGroup = document.createElement('div');
    saveGroup.className = 'sprite-gen-save-section';
    var saveHeader = document.createElement('div');
    saveHeader.className = 'form-label';
    saveHeader.textContent = 'Save to Library';
    saveGroup.appendChild(saveHeader);

    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'form-input';
    nameInput.placeholder = 'Sprite name';
    nameInput.value = suggestName(data.prompt);
    saveGroup.appendChild(nameInput);

    var saveBtnRow = document.createElement('div');
    saveBtnRow.className = 'sprite-gen-save-btns';
    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent = 'Save';
    saveBtnRow.appendChild(saveBtn);
    var clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn-ghost';
    clearBtn.textContent = 'Discard';
    saveBtnRow.appendChild(clearBtn);
    saveGroup.appendChild(saveBtnRow);

    controls.appendChild(saveGroup);
    previewSection.appendChild(controls);
    resultArea.appendChild(previewSection);

    // -- Redraw helper --
    var origCanvasRef = parentSprite ? canvasArea.querySelector('.sprite-gen-compare-block:first-child canvas') : null;
    var mainCanvas = parentSprite ? canvasArea.querySelector('.sprite-gen-compare-block:last-child canvas') : canvasArea.querySelector('canvas');

    function redraw() {
      window.GridRenderer.drawSprite(mainCanvas, data.pixels, data.palette, currentZoom);
      if (showGrid) window.GridRenderer.drawOverlay(mainCanvas, currentZoom);
      if (origCanvasRef && parentSprite) {
        window.GridRenderer.drawSprite(origCanvasRef, parentSprite.pixels, parentSprite.palette, currentZoom);
        if (showGrid) window.GridRenderer.drawOverlay(origCanvasRef, currentZoom);
      }
    }

    zoomSlider.addEventListener('input', function () {
      currentZoom = parseInt(zoomSlider.value, 10);
      zoomVal.textContent = currentZoom + 'x';
      redraw();
    });

    gridCb.addEventListener('change', function () {
      showGrid = gridCb.checked;
      redraw();
    });

    // -- Save handler --
    saveBtn.addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) {
        window.App.showToast('Please enter a sprite name.', 'error');
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving\u2026';

      var payload = {
        name: name,
        prompt: data.prompt,
        width: data.width,
        height: data.height,
        pixels: data.pixels,
        palette: data.palette,
        commands: data.commands,
      };
      if (parentSprite) payload.parentId = parentSprite.id;

      window.API.saveSprite(project.id, payload)
        .then(function () {
          generatedData = null;
          resultArea.innerHTML = '';
          window.App.showToast('Sprite saved!', 'success');
          window.App.clearParentSprite();
          window.App.refreshLibrary();
        })
        .catch(function (err) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save';
          window.App.showToast('Save failed: ' + (err.message || 'Unknown error'), 'error');
        });
    });

    clearBtn.addEventListener('click', function () {
      generatedData = null;
      resultArea.innerHTML = '';
      window.App.clearParentSprite();
    });
  }

  function suggestName(prompt) {
    if (!prompt) return '';
    return prompt.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 0; }).slice(0, 4).join('-').toLowerCase();
  }

  function stopTimer() {
    if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
  }

  window.SpriteGen = { render: render };
})();
