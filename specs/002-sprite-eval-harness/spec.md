# Feature Specification: Sprite Generation Eval Harness

**Feature Branch**: `002-sprite-eval-harness`
**Created**: 2026-03-14
**Status**: Draft
**Input**: User description: "Command-line evaluation tool that systematically tests and scores the quality of LLM-generated sprites using an LLM-as-judge approach, enabling A/B testing of system prompts, model comparison, and quality tracking over time."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run a Quality Evaluation (Priority: P1)

A developer is tuning the sprite generation system prompt. They run the eval harness with the current system prompt against a standard set of test prompts (e.g., "top-down yellow tank", "wooden crate", "red dragon", "grass tile"). For each prompt, the harness generates a sprite through the normal pipeline, then sends the result to a second LLM call that acts as a quality judge. The judge scores each sprite on multiple dimensions. At the end, the developer sees a summary table showing scores per prompt and overall averages, plus a detailed JSON report saved to disk with all the generated sprite data for visual review.

**Why this priority**: Without the ability to run an evaluation, there's no way to systematically improve sprite quality. This is the core loop.

**Independent Test**: Can be tested by running the eval command with a single test prompt and verifying it produces a score report with all quality dimensions rated.

**Acceptance Scenarios**:

1. **Given** the eval harness is configured with test prompts and a system prompt, **When** the developer runs the eval, **Then** each prompt produces a sprite and a quality score across all dimensions
2. **Given** an eval run completes, **When** the developer views the results, **Then** they see a summary table with per-prompt scores and overall averages printed to the terminal
3. **Given** an eval run completes, **When** the developer checks the output directory, **Then** a JSON report exists containing the system prompt used, each test prompt, the generated drawing commands, rasterized pixel data, and all quality scores
4. **Given** a test prompt fails during generation (LLM error), **When** the eval continues, **Then** the failed prompt is marked as failed in the report and does not block other prompts

---

### User Story 2 - Compare Two System Prompts (Priority: P1)

A developer has written a new version of the system prompt and wants to compare it against the current one. They run the eval harness twice — once with each prompt version — using the same test prompt set and same model. They then compare the two result reports side by side. The summary tables make it immediately clear which prompt version scores higher on each quality dimension.

**Why this priority**: A/B comparison is the primary use case — without it, prompt tuning is guesswork.

**Independent Test**: Can be tested by running two evals with different system prompt files and comparing the output scores.

**Acceptance Scenarios**:

1. **Given** two eval result files exist, **When** the developer reviews them, **Then** they can compare scores for the same test prompts across the two runs
2. **Given** each eval run, **When** results are saved, **Then** the filename includes the system prompt version and timestamp so runs are distinguishable

---

### User Story 3 - Manage Test Prompt Sets (Priority: P2)

A developer wants to test sprites across different categories — vehicles, characters, terrain tiles, items, obstacles. They create a test prompt set file (JSON) containing prompts with expected dimensions and optional notes about what a good result should look like. They can create multiple prompt sets for different evaluation needs (e.g., "vehicles-only", "all-categories", "small-tiles").

**Why this priority**: Different prompt sets let developers focus evaluation on specific problem areas rather than always running the full suite.

**Independent Test**: Can be tested by creating a custom prompt set file and running an eval against it, verifying all prompts in the set are evaluated.

**Acceptance Scenarios**:

1. **Given** a prompt set JSON file exists, **When** the developer runs the eval with that set, **Then** every prompt in the set is evaluated
2. **Given** a default prompt set is included, **When** the developer runs the eval with no prompt set specified, **Then** the default set is used

---

### Edge Cases

- What happens when the LLM judge returns unparseable scores? The harness uses default scores of 0 and flags the prompt as "judge-failed" in the report.
- What happens when the OpenRouter API key is missing? The harness exits immediately with a clear error message before running any prompts.
- What happens when a test prompt set file doesn't exist? The harness exits with an error listing available prompt sets.
- What happens when the eval is interrupted mid-run? Partial results are saved for any completed prompts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST run as a command-line script that evaluates sprite generation quality across a set of test prompts
- **FR-002**: System MUST accept a system prompt version identifier (maps to a JS module in `eval/system-prompts/{version}.js`) and a test prompt set identifier (maps to `eval/prompt-sets/{name}.json`) as command-line arguments
- **FR-003**: System MUST reuse the existing Asset Forge rasterizer and LLM service modules for sprite generation
- **FR-004**: For each test prompt, the system MUST generate a sprite using the specified system prompt, then evaluate the result by sending the original prompt text, the drawing commands, and a statistical summary of the pixel output (color distribution, coverage percentage, command count) to a separate LLM judge call
- **FR-005**: The LLM judge MUST score each sprite on these quality dimensions (each scored 1-10):
  - **Component Separation** (`componentSeparation`): Are distinct parts of the sprite visually distinguishable from each other?
  - **Color Usage** (`colorUsage`): Does the sprite use good contrast, multiple shades, and the available palette effectively?
  - **Detail Density** (`detailDensity`): Does the sprite contain sufficient drawing commands, internal texture, and small details?
  - **Spatial Coverage** (`spatialCoverage`): Does the sprite fill the grid appropriately without excessive empty space?
  - **Prompt Adherence** (`promptAdherence`): Does the sprite look like what was described in the prompt?
- **FR-006**: System MUST print a summary table to the terminal showing per-prompt scores and overall averages after each eval run
- **FR-007**: System MUST save a detailed JSON report to the output directory containing: run metadata (timestamp, system prompt version, model used, prompt set name), and for each prompt: the test prompt text, dimensions, generated drawing commands, rasterized pixel data, all quality scores with judge reasoning
- **FR-008**: System MUST include a default test prompt set covering at least 5 categories (vehicles, characters, terrain, items, obstacles) with 2 prompts per category (10 minimum)
- **FR-009**: System MUST handle generation failures gracefully — mark failed prompts in the report and continue with remaining prompts
- **FR-010**: System MUST support configuring which LLM model to use for generation and which to use for judging (they can be different)

### Key Entities

- **Eval Run**: A single execution of the harness with a specific system prompt version, test prompt set, and model configuration. Produces one result report.
- **Test Prompt**: A prompt string with target dimensions (width, height) and an optional quality hint describing what a good result looks like.
- **Test Prompt Set**: A named collection of test prompts stored as a JSON file.
- **Quality Score**: A set of 1-10 ratings across the five quality dimensions, plus an overall average and judge reasoning text.
- **Result Report**: A JSON file containing the full eval run data — metadata, generated sprites, and scores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can run a full evaluation of 10 test prompts and see scored results in under 15 minutes (dominated by LLM response time, not harness overhead)
- **SC-002**: Two consecutive runs with the same system prompt, prompt set, and model produce quality dimension scores that agree within 2 points on average (judge consistency)
- **SC-003**: The eval harness clearly distinguishes between a known-good system prompt and a deliberately bad one (e.g., "just output random commands") with at least a 3-point average score difference
- **SC-004**: Result reports contain enough data (pixel arrays, commands, scores, reasoning) to reconstruct and visually review every generated sprite without re-running the evaluation
