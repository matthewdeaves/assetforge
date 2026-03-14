// Asset Forge — Library Browser Component
// Renders a thumbnail grid of saved sprites with detail view, export, and variation support.

(function () {
  'use strict';

  // Current detail-view state
  var selectedSprite = null;
  var zoomLevel = 4;
  var showGrid = false;

  /**
   * Render the library view into the given container element.
   */
  async function render(container, project) {
    selectedSprite = null;
    zoomLevel = 4;
    showGrid = false;

    container.innerHTML =
      '<div class="text-center mt-lg"><p class="text-muted">Loading sprites...</p></div>';

    var sprites;
    try {
      sprites = await API.getSprites(project.id);
    } catch (err) {
      container.innerHTML = '';
      App.showToast('Failed to load sprites: ' + err.message, 'error');
      return;
    }

    if (!sprites || sprites.length === 0) {
      renderEmptyState(container);
      return;
    }

    renderGridView(container, project, sprites);
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  function renderEmptyState(container) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-state-icon">&#127912;</div>' +
        '<h2 class="empty-state-title">No sprites yet!</h2>' +
        '<p class="empty-state-text">' +
          'Switch to the Generate tab to create your first sprite.' +
        '</p>' +
      '</div>';
  }

  // ---------------------------------------------------------------------------
  // Grid view — thumbnail cards
  // ---------------------------------------------------------------------------

  function renderGridView(container, project, sprites) {
    var html =
      '<div class="section-header">' +
        '<h2 class="section-title">Sprite Library</h2>' +
        '<button class="btn btn-secondary btn-small" id="lib-export-all">Export All (.dsk)</button>' +
      '</div>' +
      '<div class="sprite-grid" id="lib-grid"></div>';

    container.innerHTML = html;

    // Export All handler
    document.getElementById('lib-export-all').addEventListener('click', function () {
      window.open(API.exportProjectUrl(project.id), '_blank');
    });

    var grid = document.getElementById('lib-grid');

    // Load each sprite fully for thumbnails
    sprites.forEach(function (spriteMeta) {
      var card = document.createElement('div');
      card.className = 'card sprite-card';
      card.innerHTML =
        '<div class="sprite-card-thumb">' +
          '<canvas class="sprite-thumb-canvas"></canvas>' +
        '</div>' +
        '<div class="sprite-card-name">' + App.escapeHtml(spriteMeta.name || spriteMeta.id) + '</div>';

      card.addEventListener('click', function () {
        loadAndShowDetail(container, project, sprites, spriteMeta.id);
      });

      grid.appendChild(card);

      // Load full sprite data for thumbnail
      loadThumbnail(card, project.id, spriteMeta);
    });
  }

  /**
   * Load full sprite data and render its thumbnail on the card canvas.
   */
  async function loadThumbnail(card, projectId, spriteMeta) {
    var canvas = card.querySelector('.sprite-thumb-canvas');
    try {
      var sprite = await API.getSprite(projectId, spriteMeta.id);
      if (sprite.pixels && sprite.palette) {
        GridRenderer.drawThumbnail(canvas, sprite.pixels, sprite.palette, 96);
      }
    } catch (_) {
      // Thumbnail failed to load — leave canvas blank
    }
  }

  // ---------------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------------

  async function loadAndShowDetail(container, project, sprites, spriteId) {
    container.innerHTML =
      '<div class="text-center mt-lg"><p class="text-muted">Loading sprite...</p></div>';

    var sprite;
    try {
      sprite = await API.getSprite(project.id, spriteId);
    } catch (err) {
      App.showToast('Failed to load sprite: ' + err.message, 'error');
      renderGridView(container, project, sprites);
      return;
    }

    selectedSprite = sprite;
    renderDetailView(container, project, sprites, sprite);
  }

  function renderDetailView(container, project, sprites, sprite) {
    var dateStr = '';
    if (sprite.createdAt) {
      try {
        dateStr = new Date(sprite.createdAt).toLocaleDateString();
      } catch (_) {
        dateStr = sprite.createdAt;
      }
    }

    var parentInfo = '';
    if (sprite.parentId) {
      parentInfo =
        '<p class="detail-meta-item"><strong>Parent:</strong> ' +
          App.escapeHtml(sprite.parentId) +
        '</p>';
    }

    var html =
      '<div class="section-header">' +
        '<button class="btn btn-ghost btn-small" id="lib-back">&larr; Back to Library</button>' +
        '<h2 class="section-title">' + App.escapeHtml(sprite.name || sprite.id) + '</h2>' +
      '</div>' +
      '<div class="detail-layout">' +
        '<div class="detail-preview">' +
          '<canvas id="lib-detail-canvas"></canvas>' +
          '<div class="detail-controls mt-sm">' +
            '<label class="form-label">Zoom: <span id="lib-zoom-value">' + zoomLevel + '</span></label>' +
            '<input type="range" id="lib-zoom" class="form-input" min="2" max="8" value="' + zoomLevel + '">' +
            '<label class="detail-grid-toggle">' +
              '<input type="checkbox" id="lib-grid-toggle"' + (showGrid ? ' checked' : '') + '> ' +
              'Grid overlay' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div class="detail-info">' +
          '<div class="card">' +
            '<h3 class="card-title mb-md">Sprite Details</h3>' +
            '<p class="detail-meta-item"><strong>Name:</strong> ' +
              App.escapeHtml(sprite.name || sprite.id) + '</p>' +
            '<p class="detail-meta-item"><strong>Dimensions:</strong> ' +
              (sprite.width || '?') + ' x ' + (sprite.height || '?') + '</p>' +
            (dateStr
              ? '<p class="detail-meta-item"><strong>Created:</strong> ' + App.escapeHtml(dateStr) + '</p>'
              : '') +
            parentInfo +
            (sprite.prompt
              ? '<div class="detail-prompt mt-sm">' +
                  '<strong>Prompt:</strong>' +
                  '<p class="text-muted">' + App.escapeHtml(sprite.prompt) + '</p>' +
                '</div>'
              : '') +
          '</div>' +
          '<div class="detail-actions mt-md">' +
            '<button class="btn btn-primary" id="lib-variation">Create Variation</button>' +
            '<button class="btn btn-secondary" id="lib-export">Export (.bin)</button>' +
            '<button class="btn btn-danger" id="lib-delete">Delete</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    container.innerHTML = html;

    // Draw the sprite preview
    var canvas = document.getElementById('lib-detail-canvas');
    redrawDetail(canvas, sprite);

    // Back button
    document.getElementById('lib-back').addEventListener('click', function () {
      selectedSprite = null;
      renderGridView(container, project, sprites);
    });

    // Zoom slider
    var zoomSlider = document.getElementById('lib-zoom');
    var zoomValue = document.getElementById('lib-zoom-value');
    zoomSlider.addEventListener('input', function () {
      zoomLevel = parseInt(zoomSlider.value, 10);
      zoomValue.textContent = zoomLevel;
      redrawDetail(canvas, sprite);
    });

    // Grid overlay toggle
    var gridToggle = document.getElementById('lib-grid-toggle');
    gridToggle.addEventListener('change', function () {
      showGrid = gridToggle.checked;
      redrawDetail(canvas, sprite);
    });

    // Create Variation
    document.getElementById('lib-variation').addEventListener('click', function () {
      App.startVariation(sprite);
    });

    // Export
    document.getElementById('lib-export').addEventListener('click', function () {
      window.open(API.exportSpriteUrl(project.id, sprite.id), '_blank');
    });

    // Delete
    document.getElementById('lib-delete').addEventListener('click', function () {
      handleDelete(container, project, sprites, sprite);
    });
  }

  /**
   * Redraw the detail canvas with the current zoom and grid settings.
   */
  function redrawDetail(canvas, sprite) {
    if (!sprite.pixels || !sprite.palette) return;
    GridRenderer.drawSprite(canvas, sprite.pixels, sprite.palette, zoomLevel);
    if (showGrid) {
      GridRenderer.drawOverlay(canvas, zoomLevel);
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handler
  // ---------------------------------------------------------------------------

  async function handleDelete(container, project, sprites, sprite) {
    var confirmed = window.confirm(
      'Delete sprite "' + (sprite.name || sprite.id) + '"? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await API.deleteSprite(project.id, sprite.id);
      App.showToast('Sprite deleted.', 'success');
      selectedSprite = null;
      // Re-render the full library view
      render(container, project);
    } catch (err) {
      App.showToast('Failed to delete sprite: ' + err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.Library = { render: render };
})();
