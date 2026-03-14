# Data Model: Sprite Generation Eval Harness

## Entities

### Test Prompt

A single evaluation prompt with target dimensions.

```
TestPrompt
├── prompt: string (the generation prompt, e.g., "top-down yellow tank with a big gun")
├── width: integer (target sprite width, e.g., 64)
├── height: integer (target sprite height, e.g., 64)
├── category: string (e.g., "vehicles", "characters", "terrain")
└── hint: string | null (optional description of what a good result looks like)
```

**Storage**: Part of a Test Prompt Set JSON file.

### Test Prompt Set

A named collection of test prompts.

```
TestPromptSet
├── name: string (e.g., "default", "vehicles-only")
├── description: string
└── prompts: TestPrompt[]
```

**Storage**: `eval/prompt-sets/{name}.json`

### Quality Score

Scores for a single evaluated sprite.

```
QualityScore
├── componentSeparation: integer (1-5, LLM-judged)
├── colorUsage: integer (1-5, LLM-judged)
├── detailDensity: integer (1-5, code-based)
├── spatialCoverage: integer (1-5, code-based)
├── promptAdherence: integer (1-5, LLM-judged)
├── overall: number (average of above)
├── reasoning: string (combined per-dimension reasoning)
├── componentSeparationReasoning: string
├── colorUsageReasoning: string
├── detailDensityReasoning: string
├── spatialCoverageReasoning: string
└── promptAdherenceReasoning: string
```

### Pixel Statistics

Computed statistics about a rasterized sprite.

```
PixelStats
├── totalPixels: integer
├── filledPixels: integer
├── coveragePercent: number
├── uniqueColors: integer
├── paletteSize: integer
├── paletteUtilization: number
├── commandCount: integer
└── commandsByType: { rect: int, circle: int, ... }
```

### Eval Result (per prompt)

Result of evaluating a single test prompt.

```
EvalResult
├── prompt: TestPrompt
├── status: "success" | "generation-failed" | "judge-failed"
├── commands: DrawingCommand[] | null
├── pixels: integer[][] | null
├── palette: Color[] | null
├── stats: PixelStats | null
├── scores: QualityScore | null
├── generationTimeMs: integer
├── judgingTimeMs: integer
└── error: string | null
```

### Result Report

Full output of an eval run.

```
ResultReport
├── timestamp: ISO 8601 datetime
├── systemPromptVersion: string
├── generationModel: string
├── judgingModel: string
├── promptSetName: string
├── results: EvalResult[]
└── summary: {
│     averages: QualityScore (averages across successful results)
│     totalPrompts: integer
│     successCount: integer
│     failedCount: integer
│     totalTimeMs: integer
└── }
```

**Storage**: `eval/results/{systemPromptVersion}_{timestamp}.json`
