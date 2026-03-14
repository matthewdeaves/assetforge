# Research: Human Grading Review UI

## R-001: Anchoring Bias Prevention

**Decision**: Hide LLM scores completely during the grading phase. Reveal only after the developer clicks "Finish."

**Rationale**: Anthropic's eval best practices recommend independent human scoring before comparison. Seeing LLM scores before grading creates anchoring bias — the developer unconsciously adjusts toward the LLM's numbers, making calibration data unreliable.

**Alternatives considered**:
- Show LLM scores during grading: Faster workflow but produces biased calibration data
- Show LLM scores after each sprite (before next): Partial bias — developer adjusts for subsequent sprites
- Never show LLM scores: Misses the calibration comparison value

## R-002: Calibration Metrics

**Decision**: Use four metrics per dimension: human average, LLM average, mean absolute difference (MAD), and agreement rate (percentage of sprites where scores are within 1 point).

**Rationale**: MAD shows systematic over/under-scoring. Agreement rate shows consistency. Together they identify both bias direction and reliability. A MAD > 1.0 is flagged as a calibration concern per Anthropic's guidance that LLM judges should be calibrated against human experts.

**Alternatives considered**:
- Pearson correlation: Requires larger sample sizes than typical eval runs (10-20 sprites)
- Cohen's kappa: Better for categorical agreement but harder to interpret for non-statisticians
- Simple percentage agreement: Too strict for ordinal scales — doesn't credit near-misses

## R-003: Canvas Rendering Approach

**Decision**: Render sprites on an HTML canvas by reading the pixel grid (2D array of palette indices) and palette (array of RGB objects) from the eval report. Scale each pixel to 8x8 screen pixels for visibility.

**Rationale**: The eval report already contains the full pixel grid and palette in each result entry. Canvas `putImageData` or `fillRect` calls can render this directly. This matches the existing Asset Forge rendering approach (Constitution Principle II). Using the pixel data from the report ensures the developer sees exactly what the LLM judge evaluated.

**Alternatives considered**:
- Re-rasterize from drawing commands client-side: Would require porting the rasterizer to the browser — unnecessary complexity since pixel data is already in the report
- Generate PNG server-side: Adds a dependency and extra step for no benefit

## R-004: Score Persistence Strategy

**Decision**: Save human scores by adding a `humanScores` object to each result entry in the existing eval report JSON. The server writes the updated JSON back to the same file.

**Rationale**: Keeps human and LLM scores co-located in a single file for easy comparison. No new storage mechanism needed. The existing report format is already JSON files on disk.

**Alternatives considered**:
- Separate human scores file: Requires joining data at query time, adds file management complexity
- Database: Over-engineered for a single-user dev tool with 10-50 records per report

## R-005: Server Port

**Decision**: The Asset Forge server runs on port 3777 (not 3000 as initially assumed). The review page will be served from this same server.

**Rationale**: Confirmed from `server/index.js` — `const PORT = process.env.PORT || 3777`.
