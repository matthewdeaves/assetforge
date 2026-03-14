# Data Model: Human Grading Review UI

## Entities

### Human Scores (per sprite)

Human-assigned quality scores for a single sprite, stored alongside LLM scores in the eval report.

```
HumanScores
├── componentSeparation: integer (1-5)
├── colorUsage: integer (1-5)
├── detailDensity: integer (1-5)
├── spatialCoverage: integer (1-5)
├── promptAdherence: integer (1-5)
├── overall: number (average of above)
└── timestamp: ISO 8601 datetime (when grading was completed)
```

**Storage**: Added as a `humanScores` field on each `EvalResult` entry in the existing eval report JSON file (`eval/results/{version}_{timestamp}.json`).

### Calibration Summary (computed, not stored)

Comparison metrics between human and LLM scores, computed client-side after grading.

```
CalibrationDimension
├── dimension: string (e.g., "componentSeparation")
├── humanAvg: number
├── llmAvg: number
├── meanAbsoluteDifference: number
├── agreementRate: number (percentage of sprites where |human - llm| <= 1)
└── flagged: boolean (true if meanAbsoluteDifference > 1.0)
```

```
CalibrationSummary
├── dimensions: CalibrationDimension[]
├── overallHumanAvg: number
├── overallLlmAvg: number
├── overallMAD: number
├── spritesGraded: integer
├── spritesSkipped: integer
└── totalSprites: integer
```

**Storage**: Not stored — computed on-the-fly from humanScores and LLM scores in the report.

### Report Metadata (computed, API only)

Computed server-side for the GET /api/eval/reports listing endpoint. Not stored in the report file.

```
ReportMetadata
├── filename: string
├── systemPromptVersion: string
├── timestamp: ISO 8601 datetime
├── promptSetName: string
├── totalPrompts: integer
├── successCount: integer
└── hasHumanScores: boolean (true if any result has non-null humanScores)
```

## Data Flow

1. **Input**: Eval report JSON (from feature 002) containing `results[]` with `scores` (LLM) and `pixels`/`palette`
2. **During grading**: Human scores collected in browser memory
3. **On finish**: Human scores sent to server via POST, server writes `humanScores` into each result entry in the report JSON
4. **On calibration view**: Client computes CalibrationSummary from the report's `scores` (LLM) and `humanScores` (human) fields

## Modified Existing Entity

### EvalResult (from feature 002) — extended

```
EvalResult (existing fields preserved)
├── prompt: TestPrompt
├── status: "success" | "generation-failed" | "judge-failed"
├── commands: DrawingCommand[] | null
├── pixels: integer[][] | null
├── palette: Color[] | null
├── stats: PixelStats | null
├── scores: QualityScore | null        ← LLM scores (existing)
├── humanScores: HumanScores | null    ← NEW: human scores (added by this feature)
├── generationTimeMs: integer
├── judgingTimeMs: integer
└── error: string | null
```
