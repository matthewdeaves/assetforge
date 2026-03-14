# Research: Sprite Generation Eval Harness

## R-001: LLM-as-Judge Approach

**Decision**: Use a second LLM call to evaluate each generated sprite. The judge receives the drawing commands and computed pixel statistics (not raw pixel arrays).

**Rationale**: The judge can't "see" the sprite, so we need to give it enough information to reason about quality. Drawing commands reveal structure (layering, component count, detail level). Pixel statistics reveal color distribution, coverage, and palette usage. Together, these let the judge score without needing vision capabilities.

**Alternatives considered**:
- Vision model (send rendered image): Would require rendering to PNG and a vision-capable model — adds complexity and cost
- Heuristic scoring only (no LLM): Can measure command count and coverage but can't assess prompt adherence or aesthetic quality
- Human scoring: Gold standard but doesn't scale

**Judge input format**:
- Drawing commands as JSON array
- Pixel statistics: total pixels, non-transparent pixels, coverage %, unique colors used, palette size, command count by type
- The original prompt (for prompt adherence scoring)

## R-002: Pixel Statistics for Judge Context

**Decision**: Compute statistics from the rasterized pixel grid to give the judge quantitative data.

**Statistics to compute**:
- `totalPixels`: width * height
- `filledPixels`: count of non-zero (non-transparent) pixels
- `coveragePercent`: filledPixels / totalPixels * 100
- `uniqueColors`: number of distinct palette indices used
- `paletteSize`: total palette size
- `paletteUtilization`: uniqueColors / paletteSize * 100
- `commandCount`: total drawing commands
- `commandsByType`: { rect: N, circle: N, ... }

## R-003: System Prompt Versioning

**Decision**: Store system prompts as JS modules in `eval/system-prompts/`. Each exports a function that takes (width, height) and returns the system prompt string (without palette-specific parts).

**Rationale**: The system prompt in `server/services/llm.js` is embedded in the `generateSprite` function alongside palette handling. For A/B testing, we need to extract just the quality/style instructions into swappable modules. The eval harness will temporarily override the system prompt construction in the LLM service.

**Approach**: The eval harness passes a custom system prompt builder function to a modified generate call, or patches the LLM service's prompt-building logic at runtime.

## R-004: Report File Naming

**Decision**: Reports saved as `{prompt-version}_{YYYY-MM-DD_HH-mm-ss}.json` in `eval/results/`.

**Rationale**: Includes both the prompt version (for quick identification) and timestamp (for chronological ordering). Avoids collisions.
