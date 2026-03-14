# API Contract: Eval Review Endpoints

## Base Path: `/api/eval`

### GET /api/eval/reports

List all available eval report files.

**Response 200**:
```json
{
  "reports": [
    {
      "filename": "current_2026-03-14_15-30-00.json",
      "systemPromptVersion": "current",
      "timestamp": "2026-03-14T15:30:00.000Z",
      "promptSetName": "default",
      "totalPrompts": 10,
      "successCount": 9,
      "hasHumanScores": false
    }
  ]
}
```

Reports are sorted by timestamp, most recent first.

---

### GET /api/eval/reports/:filename

Load a specific eval report by filename.

**Parameters**:
- `filename` (path) — The report JSON filename (e.g., `current_2026-03-14_15-30-00.json`)

**Response 200**: The full report JSON as produced by the eval harness, potentially with `humanScores` fields if previously graded.

**Response 404**:
```json
{ "error": "Report not found" }
```

---

### POST /api/eval/reports/:filename/human-scores

Save human scores into an existing eval report.

**Parameters**:
- `filename` (path) — The report JSON filename

**Request Body**:
```json
{
  "scores": [
    {
      "index": 0,
      "humanScores": {
        "componentSeparation": 4,
        "colorUsage": 3,
        "detailDensity": 5,
        "spatialCoverage": 4,
        "promptAdherence": 3,
        "overall": 3.8,
        "timestamp": "2026-03-14T16:00:00.000Z"
      }
    },
    {
      "index": 2,
      "humanScores": {
        "componentSeparation": 2,
        "colorUsage": 2,
        "detailDensity": 3,
        "spatialCoverage": 3,
        "promptAdherence": 1,
        "overall": 2.2,
        "timestamp": "2026-03-14T16:00:00.000Z"
      }
    }
  ]
}
```

- `index` corresponds to the position in the report's `results` array.
- Skipped sprites are simply omitted from the `scores` array.
- All dimension scores must be integers 1-5.

**Response 200**:
```json
{ "saved": 2, "total": 10 }
```

**Response 400**:
```json
{ "error": "Invalid scores: componentSeparation must be 1-5" }
```

**Response 404**:
```json
{ "error": "Report not found" }
```
