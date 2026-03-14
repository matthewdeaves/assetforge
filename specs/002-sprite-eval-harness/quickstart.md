# Quickstart: Sprite Generation Eval Harness

## Prerequisites

- Node.js 20+
- An OpenRouter API key in `openrouterkey` file at project root
- Asset Forge server dependencies installed (`cd server && npm install`)

## Run an Evaluation

```bash
# Run with default prompt set and current system prompt
node eval/run.js

# Run with a specific system prompt version
node eval/run.js --system-prompt v2

# Run with a specific prompt set
node eval/run.js --prompt-set vehicles-only

# Use a different generation model
node eval/run.js --gen-model anthropic/claude-haiku-4-5-20251001

# Use a different judge model
node eval/run.js --judge-model anthropic/claude-sonnet-4-6
```

## Compare Two Prompt Versions

```bash
# Run eval with version A
node eval/run.js --system-prompt current

# Run eval with version B
node eval/run.js --system-prompt v2

# Compare results by looking at the two most recent reports
ls -la eval/results/
```

## Create a Custom Prompt Set

Create a JSON file in `eval/prompt-sets/`:

```json
{
  "name": "my-test-set",
  "description": "Testing specific sprite types",
  "prompts": [
    {
      "prompt": "top-down yellow tank with a big gun",
      "width": 64,
      "height": 64,
      "category": "vehicles",
      "hint": "Should have distinct tracks, hull, turret, and barrel"
    },
    {
      "prompt": "small green bush",
      "width": 32,
      "height": 32,
      "category": "terrain"
    }
  ]
}
```

Then run: `node eval/run.js --prompt-set my-test-set`

## Output

Results are saved to `eval/results/` as JSON files. Each report contains:
- Run metadata (timestamp, models, prompt version)
- For each prompt: commands, pixels, palette, statistics, quality scores with reasoning
- Summary averages across all prompts
