# nginx-analyze CI Client

A **CI pipeline client** that discovers nginx configuration files in your repo, sends them to the nginx-analyze server for analysis, and reports the results. Use it in GitHub Actions, GitLab CI, or any CI to validate nginx configs on every run.

## How users can use it

**Option A – npx (recommended when published to npm)**

```bash
npx @nginly/client . --strict
```

Set `NGINX_ANALYZE_SERVER_URL` and `NGINX_ANALYZE_TOKEN` in your environment or CI secrets.

**Option B – Copy `ci-client` into your repo**

1. Copy the `ci-client` folder into your project (e.g. next to your `nginx/` configs).
2. In CI: install deps, build the binary, then run it with env vars set.

**Option C – Run with Node/Bun from source**

1. Copy the `ci-client` folder into your project.
2. In CI: `bun install` (or `npm ci`), then run `bun run src/index.ts <directory> --strict` (or `node dist/index.js` after `npm run build`).

**Required:** Set **NGINX_ANALYZE_SERVER_URL** (server base URL) and **NGINX_ANALYZE_TOKEN** (API key) in your environment or CI secrets. No analyzer runs locally—all analysis is done on your server.

---

## What it does

1. **Gather** – Scans a directory (default: current) for nginx config files, respects `include` directives, and groups them into independent config trees.
2. **Send** – POSTs the discovered trees and file contents to your nginx-analyze server (`/analyze`).
3. **Result** – Prints analysis summary, issues (errors/warnings/info), scores, and exits with a code suitable for CI (fail on errors or warnings in strict mode).

## Requirements

- **Node.js** ≥ 18 or **Bun**
- **Server** – A running nginx-analyze server (base URL + API key)
- **API key** – From your nginx-analyze server (e.g. `NGINX_ANALYZE_TOKEN`)

## Installation

**With Bun (recommended for CI):**

```bash
cd ci-client
bun install
bun run build:binary   # produces ./nginx-analyze-ci (single binary)
```

**With npm:**

```bash
cd ci-client
npm install
npm run build          # produces dist/index.js
```

Run from source (no build):

```bash
bun run src/index.ts [directory] [options]
```

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
# Analyze current directory (env vars set)
./nginx-analyze-ci
# or
bun run src/index.ts

# Analyze a specific directory
./nginx-analyze-ci ./nginx
./nginx-analyze-ci ../nginx --strict

# Pass API key via CLI
./nginx-analyze-ci . --key YOUR_API_KEY

# Strict mode: exit non-zero on warnings
./nginx-analyze-ci . --strict

# JSON output (for parsing in CI)
./nginx-analyze-ci . --format json

# Custom glob for nginx files
./nginx-analyze-ci . --pattern "**/*.conf"

# Verbose (trees, file counts)
./nginx-analyze-ci . --verbose

# Environment tag
./nginx-analyze-ci . --environment production
NGINX_ANALYZE_ENVIRONMENT=pre ./nginx-analyze-ci .

# Allow quota exceeded: pass (exit 0) with warning instead of failing when usage limit is hit
./nginx-analyze-ci . --allow-quota-exceeded
```

## CI pipeline examples

### GitHub Actions (Bun + binary)

Add repo secrets: **NGINX_ANALYZE_SERVER_URL**, **NGINX_ANALYZE_TOKEN**.

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

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Build CI client
        run: |
          cd ci-client
          bun install
          bun run build:binary

      - name: Run nginx analyze
        env:
          NGINX_ANALYZE_SERVER_URL: ${{ secrets.NGINX_ANALYZE_SERVER_URL }}
          NGINX_ANALYZE_TOKEN: ${{ secrets.NGINX_ANALYZE_TOKEN }}
        run: |
          cd ci-client
          chmod +x nginx-analyze-ci
          ./nginx-analyze-ci ../nginx --strict
```

### GitHub Actions (Node + built JS)

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install and build CI client
        run: |
          cd ci-client
          npm ci
          npm run build

      - name: Run nginx analyze
        env:
          NGINX_ANALYZE_SERVER_URL: ${{ secrets.NGINX_ANALYZE_SERVER_URL }}
          NGINX_ANALYZE_TOKEN: ${{ secrets.NGINX_ANALYZE_TOKEN }}
        run: |
          cd ci-client
          node dist/index.js ../nginx --strict
```

### GitLab CI

```yaml
nginx-analyze:
  image: node:20
  variables:
    NGINX_ANALYZE_SERVER_URL: $NGINX_ANALYZE_SERVER_URL
    NGINX_ANALYZE_TOKEN: $NGINX_ANALYZE_TOKEN
  before_script:
    - cd ci-client && npm ci && npm run build
  script:
    - node dist/index.js .. --strict
```

### Generic (any CI)

Set **NGINX_ANALYZE_SERVER_URL** and **NGINX_ANALYZE_TOKEN** in your CI secrets, then:

```bash
cd ci-client && bun install && bun run build:binary && ./nginx-analyze-ci /path/to/nginx --strict
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
