import { findIndependentConfigTrees, type ConfigTree } from "./fileDiscovery";
import { FORMAT_JSON, EXIT_SUCCESS, EXIT_LICENSE_ERROR } from "./constants";
import { extractSslFiles, type SslFileInfo } from "./sslFileDetector";
import { displayIssues, displaySummary } from "./output";
import { handleCiExitCode } from "./exitHandlers";
import { handleCiError } from "./errorHandlers";
import { Command } from "commander";
import { resolve } from "path";
import { readFileSync } from "fs";
import chalk from "chalk";

const getKey = (options: Record<string, unknown>): string | null => (options.key as string) ?? process.env.NGINX_ANALYZE_TOKEN ?? null;

const getEnvironment = (options: Record<string, unknown>): string => (options.environment as string) ?? process.env.NGINX_ANALYZE_ENVIRONMENT ?? "";

function relativePath(base: string, full: string): string {
  const baseParts = base.split(/[/\\]/).filter(Boolean);
  const fullParts = full.split(/[/\\]/).filter(Boolean);
  let i = 0;
  while (i < baseParts.length && i < fullParts.length && baseParts[i] === fullParts[i]) i++;
  const rel = fullParts.slice(i).join("/");
  return rel || (fullParts[fullParts.length - 1] ?? "");
}

const toRelativePath = (baseDir: string, absolutePath: string): string => relativePath(resolve(baseDir), resolve(absolutePath));

const buildPayload = (
  trees: ConfigTree[],
  baseDir: string,
  fileContents: Map<string, string>
): { trees: { allFiles: string[] }[]; files: Record<string, string>; sslFiles: SslFileInfo[] } => {
  const files: Record<string, string> = {};
  const allAbsolutePaths: string[] = [];

  const treesPayload = trees.map((tree) => {
    const allFiles = tree.allFiles.map((absPath) => {
      const rel = toRelativePath(baseDir, absPath);
      if (!files[rel]) files[rel] = fileContents.get(absPath) ?? readFileSync(absPath, "utf-8");
      allAbsolutePaths.push(absPath);
      return rel;
    });
    return { allFiles };
  });

  const sslFiles = extractSslFiles(allAbsolutePaths, baseDir);

  return { trees: treesPayload, files, sslFiles };
};

const getAnalyzeUrl = (): string => {
  const raw = process.env.NGINX_ANALYZE_SERVER_URL?.trim() ?? process.env.NGINX_ANALYZE_URL?.trim() ?? "";
  const base = raw && raw.startsWith("http") ? raw.replace(/\/$/, "") : "https://nginly.com";
  return `${base}/analyze`;
};

async function handleCiClientCommand(directory: string, options: Record<string, unknown>): Promise<void> {
  const key = getKey(options);

  if (!key?.trim()) {
    console.error(chalk.red("Missing API key. Set --key or NGINX_ANALYZE_TOKEN"));
    process.exit(EXIT_LICENSE_ERROR);
  }

  const analyzeUrl = getAnalyzeUrl();

  console.log(chalk.blue("CI client: discovering nginx configurations..."));
  console.log(chalk.gray(`Directory: ${directory}`));
  if (options.verbose) console.log(chalk.gray(`Server: ${analyzeUrl}`));
  if (options.strict) console.log(chalk.gray("Mode: strict"));
  if (options.allowQuotaExceeded) console.log(chalk.gray("Mode: allow-quota-exceeded"));

  const { trees: configTrees, fileContents } = await findIndependentConfigTrees(directory, options as { pattern?: string; verbose?: boolean });

  if (configTrees.length === 0) {
    console.log(chalk.yellow("\nNo nginx configuration files found"));
    process.exit(EXIT_SUCCESS);
    return;
  }

  const totalFiles = configTrees.reduce((sum, t) => sum + t.allFiles.length, 0);
  console.log(chalk.green(`\nFound ${totalFiles} file(s) in ${configTrees.length} tree(s)`));
  if (options.verbose) {
    configTrees.forEach((tree, i) => {
      console.log(chalk.cyan(`  Tree ${i + 1}: ${tree.allFiles.length} file(s)`));
    });
  }

  const baseDir = resolve(directory);
  const { trees, files, sslFiles } = buildPayload(configTrees, baseDir, fileContents);

  if (options.verbose) {
    console.log(chalk.gray(`Sending ${trees.length} tree(s), ${Object.keys(files).length} file(s) to server`));
    if (sslFiles.length > 0) console.log(chalk.gray(`Found ${sslFiles.length} SSL certificate reference(s)`));
  }

  const environment = getEnvironment(options);
  const body = JSON.stringify({ key, strict: Boolean(options.strict), trees, files, sslFiles, environment });
  let response: Response;

  try {
    response = await fetch(analyzeUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Request failed: ${message}`));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }

  const text = await response.text();

  if (response.status === 401) {
    console.error(chalk.red("Invalid or missing API key"));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }

  if (response.status === 402 && options.allowQuotaExceeded) {
    let errorMessage = "Usage limit exceeded for this billing period.";
    try {
      const json = JSON.parse(text) as { error?: string; usage?: number; limit?: number; tier?: string };
      if (json.error) errorMessage = json.error;
      if (json.usage !== undefined && json.limit !== undefined) {
        errorMessage += ` (${json.usage}/${json.limit} used, tier: ${json.tier ?? "unknown"})`;
      }
    } catch {
      // use default
    }
    console.warn(chalk.yellow(`\n⚠ ${errorMessage} Analysis skipped. Job passed with --allow-quota-exceeded.`));
    process.exit(EXIT_SUCCESS);
    return;
  }

  if (!response.ok) {
    let errorMessage = `Server error: ${response.status}`;
    try {
      const json = JSON.parse(text) as { error?: string };
      if (json.error) errorMessage = json.error;
    } catch {
      // use status text
    }
    console.error(chalk.red(errorMessage));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }

  let result: Record<string, unknown>;
  try {
    result = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error(chalk.red("Invalid JSON response from server"));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }

  if (options.format === FORMAT_JSON) {
    console.log(JSON.stringify(result, null, 2));
    handleCiExitCode(result, options);
    return;
  }

  console.log(chalk.cyan("\nCI Analysis Summary:"));
  console.log(chalk.gray(`  Trees: ${result.treesAnalyzed ?? 0}`));
  console.log(chalk.gray(`  Files: ${result.filesAnalyzed ?? 0}`));
  console.log(chalk.gray(`  Successful: ${result.successCount ?? 0}`));
  if (Number(result.failureCount) > 0) console.log(chalk.red(`  Failed: ${result.failureCount}`));

  displayIssues((result.issues ?? []) as Parameters<typeof displayIssues>[0]);
  displaySummary(result as unknown as Parameters<typeof displaySummary>[0]);
  handleCiExitCode(result, options);
}

const program = new Command();

program.name("nginx-analyze-ci").description("CI client: discover nginx configs and send to analysis server").version("0.1.0");

program
  .argument("[directory]", "Directory to search for nginx configs", ".")
  .option("-s, --strict", "Fail on warnings")
  .option("-v, --verbose", "Verbose output")
  .option("--format <format>", "Output format (json|text)", "text")
  .option("--pattern <pattern>", "Custom search pattern for nginx files")
  .option("--key <key>", "API key (or NGINX_ANALYZE_TOKEN)")
  .option("--environment <env>", "Environment name e.g. production, dev, pre (or NGINX_ANALYZE_ENVIRONMENT)")
  .option("--allow-quota-exceeded", "Pass with warning when usage limit exceeded (402) instead of failing")
  .action(async (directory: string, options: Record<string, unknown>) => {
    try {
      await handleCiClientCommand(directory, options);
    } catch (error) {
      handleCiError(error);
    }
  });

program.parse();
