# nginx-analyze CI Client

A **CI pipeline client** that discovers nginx configuration files in your repo, sends them to the nginx-analyze server for analysis, and reports the results. Use it in GitHub Actions, GitLab CI, or any CI to validate nginx configs on every run.

## How users can use it

Install and run the **nginly-client** package from npm (no global install):

```bash
npm i nginly-client
```

Set **NGINX_ANALYZE_SERVER_URL** (server base URL) and **NGINX_ANALYZE_TOKEN** (API key) in your environment or CI secrets. No analyzer runs locally—all analysis is done on your server.

---

## What it does

1. **Gather** – Scans a directory (default: current) for nginx config files, respects `include` directives, and groups them into independent config trees.
2. **Send** – POSTs the discovered trees and file contents to your nginx-analyze server (`/analyze`).
3. **Result** – Prints analysis summary, issues (errors/warnings/info), scores, and exits with a code suitable for CI (fail on errors or warnings in strict mode).

## Requirements

- **Node.js** ≥ 18 or **Bun**
- **API key** – From your nginx-analyze server (e.g. `NGINX_ANALYZE_TOKEN`)

## Installation

No install needed when using **npx** (recommended):

```bash
npx nginly-client [directory] [options]
```

Node.js ≥ 18 is required (npx comes with npm).

## Configuration

| Source | Server URL | API key | Environment |
|--------|------------|---------|-------------|
| Env | `NGINX_ANALYZE_SERVER_URL` | `NGINX_ANALYZE_TOKEN` | `NGINX_ANALYZE_ENVIRONMENT` |
| CLI | — | `--key <key>` | `--environment <env>` |

**Server URL** – Base URL of your nginx-analyze server (e.g. `https://nginx-analyze.example.com`). Set via `NGINX_ANALYZE_SERVER_URL` only.  
**API key** – Required; set `NGINX_ANALYZE_TOKEN` or pass `--key`.  
**Environment** – Optional; e.g. `production`, `dev`, `pre` for server to tag runs.

## Usage

```bash
# Analyze a specific directory
npx nginly-client ./nginx

# Pass API key via CLI
npx nginly-client . --key YOUR_API_KEY

# Strict mode: exit non-zero on warnings
npx nginly-client . --strict

# JSON output (for parsing in CI)
npx nginly-client . --format json

# Custom glob for nginx files
npx nginly-client . --pattern "**/*.conf"

# Verbose (trees, file counts)
npx nginly-client . --verbose

# Environment tag
npx nginly-client . --environment production
NGINX_ANALYZE_ENVIRONMENT=pre npx nginly-client .

# Allow quota exceeded: pass (exit 0) with warning instead of failing when usage limit is hit
npx nginly-client . --allow-quota-exceeded
```

## CI pipeline examples

Add repo secrets: **NGINX_ANALYZE_SERVER_URL**, **NGINX_ANALYZE_TOKEN**.

### GitHub Actions

```yaml
name: nginx analyze

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  nginx:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Run nginly-client
        env:
          NGINX_ANALYZE_SERVER_URL: ${{ secrets.NGINX_ANALYZE_SERVER_URL }}
          NGINX_ANALYZE_TOKEN: ${{ secrets.NGINX_ANALYZE_TOKEN }}
        run: npx nginly-client . --strict
```

### GitLab CI

```yaml
nginx-analyze:
  image: node:20
  variables:
    NGINX_ANALYZE_SERVER_URL: $NGINX_ANALYZE_SERVER_URL
    NGINX_ANALYZE_TOKEN: $NGINX_ANALYZE_TOKEN
  script:
    - npx nginly-client . --strict
```


## CLI options

| Option | Description |
|--------|-------------|
| `[directory]` | Directory to search (default: `.`) |
| `-s, --strict` | Exit non-zero on warnings (not only errors) |
| `-v, --verbose` | Log trees and file counts |
| `--format <format>` | `json` or `text` (default: `text`) |
| `--pattern <glob>` | Custom glob for nginx files |
| `--key <key>` | API key (or `NGINX_ANALYZE_TOKEN`) |
| `--environment <env>` | Environment name (or `NGINX_ANALYZE_ENVIRONMENT`) |

Server URL is set only via **NGINX_ANALYZE_SERVER_URL** (no CLI flag).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success; no errors (and no warnings in strict mode) |
| 1 | Warnings (or strict: analysis had warnings) |
| 2 | Errors reported by server |
| 4 | Client/request error (missing key, server unreachable, invalid response) |

Use in CI to fail the job on errors or, with `--strict`, on warnings.

## Output

- **Text (default)** – Human-readable summary, issue list, and scores.
- **JSON (`--format json`)** – Full server response as JSON for scripting.
