# varpet

Autonomous bug-fixing agent. Reads Jira tickets, analyzes repositories, applies minimal patches, and creates pull requests.

## Installation

```bash
npm install -g varpet
```

## Quick Start

```bash
# Fix a bug from a Jira ticket
varpet fix --jira PROJ-123 --repo .

# Fix with a specific base branch
varpet fix --jira PROJ-123 --repo . --base develop

# Dry run (simulate without making changes)
varpet fix --jira PROJ-123 --repo . --dry-run

# Resume a previous run
varpet resume --run-id <uuid>

# Check status of a run
varpet status --run-id <uuid>
```

## Configuration

Varpet requires environment variables for connecting to external services. Create a `.env` file in your project root or export them in your shell:

### Required

```bash
# Jira (Cloud: use email + API token, Server: use PAT)
JIRA_URL=https://your-org.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=your-jira-api-token

# GitHub
GITHUB_TOKEN=your-github-token

# At least one LLM provider key
ANTHROPIC_API_KEY=your-key
# or
OPENAI_API_KEY=your-key
# or
GEMINI_API_KEY=your-key
```

### Optional

```bash
# Model configuration (defaults shown)
VARPET_REASONING_MODEL=anthropic/claude-sonnet-4-20250514
VARPET_PATCHING_MODEL=anthropic/claude-sonnet-4-20250514
VARPET_MAX_ITERATIONS=5
VARPET_CONFIDENCE_THRESHOLD=0.7
VARPET_LOG_LEVEL=INFO
```

## Commands

### `varpet fix`

Fix a bug described in a Jira ticket.

| Option               | Short | Default | Description                              |
|----------------------|-------|---------|------------------------------------------|
| `--jira`             | `-j`  | *required* | Jira issue key (e.g., PROJ-123)       |
| `--repo`             | `-r`  | `.`     | Path to repository (or URL to clone)     |
| `--base`             | `-b`  | `main`  | Base branch to create fix branch from    |
| `--dry-run`          |       | `false` | Simulate without modifying files         |
| `--max-iterations`   | `-n`  | `5`     | Max fix/validate iterations              |
| `--model`            | `-m`  |         | Override reasoning model                 |
| `--verbose`          |       | `false` | Enable debug logging                     |

### `varpet resume`

Resume a previous run from its saved state.

| Option      | Short | Default | Description            |
|-------------|-------|---------|------------------------|
| `--run-id`  |       | *required* | Run ID to resume    |
| `--repo`    | `-r`  | `.`     | Path to repository     |
| `--verbose` |       | `false` | Enable debug logging   |

### `varpet status`

Show the status of a previous run.

| Option     | Short | Default | Description            |
|------------|-------|---------|------------------------|
| `--run-id` |       | *required* | Run ID to check     |
| `--repo`   | `-r`  | `.`     | Path to repository     |

## How It Works

1. **Fetch Jira** - Reads the bug ticket and extracts signals (stack traces, error messages)
2. **Prepare Repo** - Clones/verifies the repository and creates a work branch
3. **Build Index** - Builds an AST + embedding index of the codebase
4. **Retrieve Context** - Finds relevant code using ripgrep + semantic search
5. **Investigate** - LLM analyzes root cause, generates hypotheses
6. **Plan Patch** - LLM creates a minimal patch plan
7. **Apply Patch** - Applies changes with fallback strategies
8. **Generate Tests** - LLM writes a regression test
9. **Validate** - Runs tests, computes confidence score
10. **Create PR** - Commits, pushes, creates GitHub PR (or retries on failure)

## Supported Platforms

| Platform             | Architecture |
|----------------------|-------------|
| macOS                | ARM64 (Apple Silicon) |
| macOS                | x64 (Intel) |
| Linux                | x64         |
| Windows              | x64         |

## License

Apache-2.0
