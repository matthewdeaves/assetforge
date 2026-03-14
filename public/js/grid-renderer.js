// Canvas-based grid renderer for palette-indexed pixel art sprites.
// Renders pixel data onto HTML canvas elements at adjustable zoom scales.

window.GridRenderer = (function () {
  /**
   * Draw a palette-indexed sprite onto a canvas.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {number[][]} pixels - 2D array of palette indices (rows x cols)
   * @param {{r:number, g:number, b:number}[]} palette
   * @param {number} cellSize - pixels per cell (2-8)
   */
  function drawSprite(canvas, pixels, palette, cellSize) {
    var height = pixels.length;
    var width = height > 0 ? pixels[0].length : 0;

    canvas.width = width * cellSize;
    canvas.height = height * cellSize;

    var ctx = canvas.getContext('2d');

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var idx = pixels[y][x];
        var cx = x * cellSize;
        var cy = y * cellSize;

        if (idx === 0) {
          drawCheckerboard(ctx, cx, cy, cellSize);
        } else {
          var c = palette[idx];
          ctx.fillStyle = 'rgb(' + c.r + ',' + c.g + ',' + c.b + ')';
          ctx.fillRect(cx, cy, cellSize, cellSize);
        }
      }
    }
  }

  /**
   * Draw a checkerboard pattern in a cell to indicate transparency.
   * Alternates 4x4 pixel squares of #ccc and #fff.
   */
  function drawCheckerboard(ctx, cx, cy, cellSize) {
    var sq = 4;
    for (var py = 0; py < cellSize; py += sq) {
      for (var px = 0; px < cellSize; px += sq) {
        var even = (Math.floor(px / sq) + Math.floor(py / sq)) % 2 === 0;
        ctx.fillStyle = even ? '#ccc' : '#fff';
        var w = Math.min(sq, cellSize - px);
        var h = Math.min(sq, cellSize - py);
        ctx.fillRect(cx + px, cy + py, w, h);
      }
    }
  }

  /**
   * Draw grid lines at pixel boundaries on top of existing content.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {number} cellSize
   */
  function drawOverlay(canvas, cellSize) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width;
    var h = canvas.height;

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    for (var x = 0; x <= w; x += cellSize) {
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
    }
    for (var y = 0; y <= h; y += cellSize) {
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
    }
    ctx.stroke();
  }

  /**
   * Clear the entire canvas.
   *
   * @param {HTMLCanvasElement} canvas
   */
  function clear(canvas) {
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /**
   * Render a small thumbnail fitting within maxSize x maxSize pixels.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {number[][]} pixels - 2D array of palette indices
   * @param {{r:number, g:number, b:number}[]} palette
   * @param {number} maxSize - maximum dimension in pixels
   */
  function drawThumbnail(canvas, pixels, palette, maxSize) {
    var height = pixels.length;
    var width = height > 0 ? pixels[0].length : 0;
    var largest = Math.max(width, height);
    var cellSize = Math.max(1, Math.floor(maxSize / largest));

    drawSprite(canvas, pixels, palette, cellSize);
  }

  return {
    drawSprite: drawSprite,
    drawOverlay: drawOverlay,
    clear: clear,
    drawThumbnail: drawThumbnail
  };
})();
