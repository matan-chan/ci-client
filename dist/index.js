// src/constants.ts
var FORMAT_JSON = "json";
var EXIT_SUCCESS = 0;
var EXIT_WARNING = 1;
var EXIT_ERROR = 2;
var EXIT_FAILURE = 3;
var EXIT_LICENSE_ERROR = 4;
var NGINX_CONFIG_PATTERNS = ["**/nginx.conf", "**/nginx/**/*.conf", "**/*.nginx.conf", "**/conf.d/**/*.conf", "**/sites-available/**/*", "**/sites-enabled/**/*", "**/*.conf"];
var EXCLUDE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/binaries/**"];

// src/fileDiscovery.ts
import { dirname, isAbsolute, join, resolve as resolve2 } from "path";

// src/utils/file.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
var readConfigFile = (filePath) => {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) throw new Error(`File not found: ${filePath}`);
  return readFileSync(absolutePath, "utf-8");
};

// src/parser/lexer.ts
var tokenize = (input) => {
  const tokens = [];
  let line = 1;
  let column = 1;
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    if (char === "\n") {
      tokens.push({ type: "NEWLINE", value: "\n", line, column });
      line++;
      column = 1;
      i++;
      continue;
    }
    if (char === " " || char === "	" || char === "\r") {
      column++;
      i++;
      continue;
    }
    if (char === "#") {
      const start = i;
      const startCol = column;
      i++;
      column++;
      while (i < input.length && input[i] !== "\n") {
        i++;
        column++;
      }
      const comment = input.slice(start + 1, i).trim();
      tokens.push({ type: "COMMENT", value: comment, line, column: startCol });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "LBRACE", value: "{", line, column });
      column++;
      i++;
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "RBRACE", value: "}", line, column });
      column++;
      i++;
      continue;
    }
    if (char === ";") {
      tokens.push({ type: "SEMICOLON", value: ";", line, column });
      column++;
      i++;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      const startCol = column;
      i++;
      column++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i += 2;
          column += 2;
        } else {
          i++;
          column++;
        }
      }
      if (i < input.length) {
        i++;
        column++;
      }
      const str = input.slice(start + 1, i - 1);
      tokens.push({ type: "STRING", value: str, line, column: startCol });
      continue;
    }
    if (/[^\s{};"'#]/.test(char ?? "")) {
      const start = i;
      const startCol = column;
      while (i < input.length && /[^\s{};"'#]/.test(input[i] ?? "")) {
        i++;
        column++;
      }
      const word = input.slice(start, i);
      tokens.push({ type: "WORD", value: word, line, column: startCol });
      continue;
    }
    i++;
    column++;
  }
  tokens.push({ type: "EOF", value: "", line, column });
  return tokens;
};

// src/parser/parser.ts
var Parser = class {
  tokens;
  current = 0;
  constructor(tokens) {
    this.tokens = tokens.filter((t) => t.type !== "NEWLINE");
  }
  parse() {
    const children = [];
    while (!this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) children.push(node);
    }
    return { type: "config", children };
  }
  parseStatement() {
    if (this.check("COMMENT")) return this.parseComment();
    if (this.check("WORD")) return this.parseDirectiveOrBlock();
    this.advance();
    return null;
  }
  parseComment() {
    const token = this.advance();
    return { type: "comment", text: token.value, location: this.makeLocation(token, token) };
  }
  parseDirectiveOrBlock() {
    const nameToken = this.advance();
    const name = nameToken.value;
    const args = [];
    while (!this.isAtEnd() && !this.check("LBRACE") && !this.check("SEMICOLON")) {
      if (this.check("WORD") || this.check("STRING")) args.push(this.advance().value);
      else break;
    }
    if (this.check("LBRACE")) return this.parseBlock(nameToken, name, args);
    if (this.check("SEMICOLON")) {
      const endToken = this.advance();
      return { type: "directive", name, args, location: this.makeLocation(nameToken, endToken) };
    }
    return { type: "directive", name, args, location: this.makeLocation(nameToken, this.previous()) };
  }
  parseBlock(startToken, name, args) {
    this.consume("LBRACE");
    const children = [];
    while (!this.isAtEnd() && !this.check("RBRACE")) {
      const node = this.parseStatement();
      if (node) children.push(node);
    }
    const endToken = this.consume("RBRACE");
    return { type: "block", name, args, children, location: this.makeLocation(startToken, endToken) };
  }
  check(type) {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }
  advance() {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }
  isAtEnd() {
    return this.peek().type === "EOF";
  }
  peek() {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1];
  }
  previous() {
    return this.tokens[this.current - 1];
  }
  consume(type) {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`Expected ${type} but got ${token.type} at line ${token.line}, column ${token.column}`);
  }
  makeLocation(start, end) {
    return { start: { line: start.line, column: start.column }, end: { line: end.line, column: end.column } };
  }
};

// src/parser/index.ts
var parseNginxConfig = (input) => {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
};

// src/utils.ts
var logVerbose = (fn, verbose) => {
  if (verbose) fn();
};

// src/fileDiscovery.ts
import { existsSync as existsSync2, statSync } from "fs";
import { glob } from "glob";
import chalk from "chalk";
var findNginxConfigs = async (directory, options) => {
  logVerbose(() => console.log(chalk.gray(`
Searching for nginx configs in: ${directory}`)), options.verbose ?? false);
  const patterns = options.pattern ? [options.pattern] : NGINX_CONFIG_PATTERNS;
  const allFiles = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: directory, absolute: true, ignore: EXCLUDE_PATTERNS, nodir: true });
    allFiles.push(...files);
  }
  const uniqueFiles = [...new Set(allFiles)];
  const validFiles = uniqueFiles.filter(isValidNginxConfig);
  logVerbose(() => console.log(chalk.gray(`Found ${validFiles.length} nginx config files`)), options.verbose ?? false);
  return validFiles;
};
var findIndependentConfigTrees = async (directory, options) => {
  const allConfigFiles = await findNginxConfigs(directory, options);
  if (allConfigFiles.length === 0) return [];
  const dependencyGraph = await buildDependencyGraph(allConfigFiles);
  const trees = findConnectedComponents(allConfigFiles, dependencyGraph);
  logVerbose(() => {
    console.log(chalk.gray(`
Found ${trees.length} independent config tree(s):`));
    trees.forEach((tree, index) => {
      console.log(chalk.gray(`  Tree ${index + 1}: ${tree.rootFiles.length} root file(s), ${tree.allFiles.length} total file(s)`));
    });
  }, options.verbose ?? false);
  return trees;
};
var buildDependencyGraph = async (files) => {
  const graph = /* @__PURE__ */ new Map();
  for (const file of files) {
    const dependencies = await extractIncludeDependencies(file, files);
    graph.set(file, dependencies);
  }
  return graph;
};
var extractIncludeDependencies = async (filePath, allFiles) => {
  const dependencies = /* @__PURE__ */ new Set();
  try {
    const content = readConfigFile(filePath);
    const ast = parseNginxConfig(content);
    const baseDir = dirname(resolve2(filePath));
    const includePaths = findIncludeDirectives(ast);
    for (const includePath of includePaths) {
      const resolvedPaths = resolveIncludePath(includePath, baseDir);
      for (const resolvedPath of resolvedPaths) {
        if (allFiles.includes(resolvedPath)) dependencies.add(resolvedPath);
      }
    }
  } catch {
  }
  return dependencies;
};
var findIncludeDirectives = (ast) => {
  const includePaths = [];
  const traverse = (nodes) => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "directive" && node.name === "include" && node.args && node.args.length > 0) includePaths.push(node.args[0]);
      if (node.children) traverse(node.children);
    }
  };
  traverse(ast.children);
  return includePaths;
};
var resolveIncludePath = (includePath, baseDir) => {
  if (hasGlobPattern(includePath)) {
    const pattern = isAbsolute(includePath) ? includePath : join(baseDir, includePath);
    return resolveGlobPattern(pattern);
  }
  const fullPath = isAbsolute(includePath) ? includePath : join(baseDir, includePath);
  if (existsSync2(fullPath)) return [fullPath];
  return [];
};
var hasGlobPattern = (path) => path.includes("*") || path.includes("?") || path.includes("[");
var resolveGlobPattern = (pattern) => {
  try {
    const matches = glob.sync(pattern, { absolute: true, nodir: true, windowsPathsNoEscape: true });
    return matches.sort();
  } catch {
    return [];
  }
};
var findConnectedComponents = (allFiles, dependencyGraph) => {
  const visited = /* @__PURE__ */ new Set();
  const trees = [];
  for (const file of allFiles) {
    if (visited.has(file)) continue;
    const component = findComponent(file, dependencyGraph, visited);
    const rootFiles = findRootFiles(component, dependencyGraph);
    trees.push({ rootFiles, allFiles: component, dependencyGraph });
  }
  return trees;
};
var findComponent = (startFile, graph, visited) => {
  const component = [];
  const queue = [startFile];
  const reverseGraph = buildReverseGraph(graph);
  while (queue.length > 0) {
    const file = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    component.push(file);
    const dependencies = graph.get(file) || /* @__PURE__ */ new Set();
    for (const dep of dependencies) {
      if (!visited.has(dep)) queue.push(dep);
    }
    const dependents = reverseGraph.get(file) || /* @__PURE__ */ new Set();
    for (const dependent of dependents) {
      if (!visited.has(dependent)) queue.push(dependent);
    }
  }
  return component;
};
var buildReverseGraph = (graph) => {
  const reverse = /* @__PURE__ */ new Map();
  for (const [file, deps] of graph.entries()) {
    if (!reverse.has(file)) reverse.set(file, /* @__PURE__ */ new Set());
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, /* @__PURE__ */ new Set());
      reverse.get(dep).add(file);
    }
  }
  return reverse;
};
var findRootFiles = (component, graph) => {
  const reverseGraph = buildReverseGraph(graph);
  const rootFiles = [];
  for (const file of component) {
    const dependents = reverseGraph.get(file) || /* @__PURE__ */ new Set();
    const hasDependentsInComponent = Array.from(dependents).some((dep) => component.includes(dep));
    if (!hasDependentsInComponent) rootFiles.push(file);
  }
  return rootFiles.length > 0 ? rootFiles : [component[0]];
};
var isValidNginxConfig = (filePath) => {
  const maxSize = 10 * 1024 * 1024;
  try {
    const stats = statSync(filePath);
    if (!stats.isFile()) return false;
    if (stats.size === 0) return false;
    if (stats.size > maxSize) return false;
    return true;
  } catch {
    return false;
  }
};

// src/output.ts
import chalk2 from "chalk";
var displayIssues = (issues) => {
  if (issues.length === 0) return;
  console.log(chalk2.bold("\n\u{1F4CB} Issues Found:\n"));
  for (const issue of issues) displayIssue(issue);
};
var displayIssue = (issue) => {
  const icon = getIssueIcon(issue.severity);
  const color = getIssueColor(issue.severity);
  const label = issue.severity.toUpperCase();
  const file = issue.location?.file ?? issue.file ?? "unknown";
  const start = issue.location?.start ?? { line: 0, column: 0 };
  console.log(color(`${icon} [${label}] ${issue.message}`));
  console.log(chalk2.gray(`   ${file}:${start.line}:${start.column}`));
  if ("suggestion" in issue && issue.suggestion) console.log(chalk2.cyan(`   \u{1F4A1} ${issue.suggestion}`));
  if ("relatedLocations" in issue && issue.relatedLocations && issue.relatedLocations.length > 0) {
    console.log(chalk2.gray("   Related locations:"));
    for (const loc of issue.relatedLocations) console.log(chalk2.gray(`   - ${loc.file}:${loc.start.line}:${loc.start.column}`));
  }
  console.log();
};
var getIssueIcon = (severity) => {
  switch (severity) {
    case "error":
      return "\u2717";
    case "warning":
      return "\u26A0";
    case "info":
      return "\u2139";
    default:
      return "\u2022";
  }
};
var getIssueColor = (severity) => {
  switch (severity) {
    case "error":
      return chalk2.red;
    case "warning":
      return chalk2.yellow;
    case "info":
      return chalk2.blue;
    default:
      return chalk2.gray;
  }
};
var displaySummary = (result) => {
  console.log(chalk2.bold("\n\u{1F4CA} Summary:"));
  if (result.errorCount > 0) console.log(chalk2.red(`  \u2717 ${result.errorCount} error${result.errorCount === 1 ? "" : "s"}`));
  if (result.warningCount > 0) console.log(chalk2.yellow(`  \u26A0 ${result.warningCount} warning${result.warningCount === 1 ? "" : "s"}`));
  if (result.infoCount > 0) console.log(chalk2.blue(`  \u2139 ${result.infoCount} info`));
  if (result.errorCount === 0 && result.warningCount === 0 && result.infoCount === 0) console.log(chalk2.green("  \u2713 No issues found"));
  displayScores(result);
};
var displayScores = (result) => {
  console.log(chalk2.bold("\n\u{1F4C8} Scores:"));
  const scoreColor = getScoreColor(result.overallScore);
  const scoreBar = generateScoreBar(result.overallScore);
  console.log(scoreColor(`  Overall Score: ${result.overallScore}/${result.maxPossibleScore} ${scoreBar}`));
  console.log(chalk2.gray("\n  Category Scores:"));
  const categories = Object.keys(result.categoryScores).sort();
  for (const category of categories) {
    const score = result.categoryScores[category];
    const categoryColor = getScoreColor(score);
    const categoryBar = generateScoreBar(score);
    console.log(categoryColor(`    ${category.padEnd(20)} ${String(score).padStart(3)}/${result.maxPossibleScore} ${categoryBar}`));
  }
};
var getScoreColor = (score) => {
  if (score >= 80) return chalk2.green;
  if (score >= 60) return chalk2.yellow;
  if (score >= 40) return chalk2.hex("#FF8800");
  return chalk2.red;
};
var generateScoreBar = (score, length = 20) => {
  const filled = Math.round(score / 100 * length);
  const empty = length - filled;
  return `[${"\u2588".repeat(filled)}${"\u2591".repeat(empty)}]`;
};

// src/exitHandlers.ts
import chalk3 from "chalk";
var handleCiExitCode = (result, options) => {
  if ((result.errorCount ?? 0) > 0) {
    console.log(chalk3.red(`
\u2717 Analysis failed with ${result.errorCount} error(s)`));
    process.exit(EXIT_ERROR);
  }
  if ((result.warningCount ?? 0) > 0 && options.strict) {
    console.log(chalk3.yellow(`
\u26A0 Analysis completed with ${result.warningCount} warning(s) (strict mode)`));
    process.exit(EXIT_WARNING);
  }
  if ((result.warningCount ?? 0) > 0) {
    console.log(chalk3.yellow(`
\u26A0 Analysis completed with ${result.warningCount} warning(s)`));
    process.exit(EXIT_WARNING);
  }
  console.log(chalk3.green("\n\u2713 All configurations analyzed successfully"));
  process.exit(EXIT_SUCCESS);
};

// src/errorHandlers.ts
import chalk4 from "chalk";
var handleCiError = (error) => {
  console.error(chalk4.red("\n\u2717 CI analysis failed"));
  if (error instanceof Error) console.error(chalk4.gray(error.message));
  process.exit(EXIT_FAILURE);
};

// src/sslFileDetector.ts
import { existsSync as existsSync3, statSync as statSync2, readFileSync as readFileSync2 } from "fs";
import { dirname as dirname2, resolve as resolve3, relative } from "path";
var SSL_DIRECTIVES = ["ssl_certificate", "ssl_certificate_key"];
var resolvePath = (filePath, baseFile) => {
  try {
    const baseDir = dirname2(resolve3(baseFile));
    return resolve3(baseDir, filePath);
  } catch {
    return null;
  }
};
var fileExists = (filePath, baseFile) => {
  const absolutePath = resolvePath(filePath, baseFile);
  if (!absolutePath) return false;
  try {
    return existsSync3(absolutePath) && statSync2(absolutePath).isFile();
  } catch {
    return false;
  }
};
var extractSslDirectivesFromNode = (node, configFile, results) => {
  if (node.type === "directive" && SSL_DIRECTIVES.includes(node.name)) {
    const directive = node.name;
    const sslFilePath = node.args[0];
    if (sslFilePath) {
      const absolutePath = resolvePath(sslFilePath, configFile);
      const exists = fileExists(sslFilePath, configFile);
      results.push({
        path: sslFilePath,
        exists,
        directive,
        referencedIn: configFile
      });
    }
  }
  if (node.type === "block") {
    for (const child of node.children) {
      extractSslDirectivesFromNode(child, configFile, results);
    }
  }
};
var parseConfigFile = (absolutePath) => {
  try {
    const content = readFileSync2(absolutePath, "utf-8");
    const tokens = tokenize(content);
    const parser = new Parser(tokens);
    return parser.parse();
  } catch {
    return null;
  }
};
var extractSslFiles = (configFiles, baseDir) => {
  const results = [];
  const seen = /* @__PURE__ */ new Set();
  for (const absoluteConfigPath of configFiles) {
    const ast = parseConfigFile(absoluteConfigPath);
    if (!ast) continue;
    const relativePath2 = relative(baseDir, absoluteConfigPath);
    const tempResults = [];
    for (const node of ast.children) {
      extractSslDirectivesFromNode(node, absoluteConfigPath, tempResults);
    }
    for (const sslFile of tempResults) {
      const absoluteSslPath = resolvePath(sslFile.path, absoluteConfigPath);
      if (!absoluteSslPath) continue;
      const relativeSslPath = relative(baseDir, absoluteSslPath);
      const key = `${relativeSslPath}:${sslFile.directive}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          path: relativeSslPath,
          exists: sslFile.exists,
          directive: sslFile.directive,
          referencedIn: relativePath2
        });
      }
    }
  }
  return results;
};

// src/index.ts
import { Command } from "commander";
import { resolve as resolve4 } from "path";
import { readFileSync as readFileSync3 } from "fs";
import chalk5 from "chalk";
var program = new Command();
program.name("nginx-analyze-ci").description("CI client: discover nginx configs and send to analysis server").version("0.1.0");
program.argument("[directory]", "Directory to search for nginx configs", ".").option("-s, --strict", "Fail on warnings").option("-v, --verbose", "Verbose output").option("--format <format>", "Output format (json|text)", "text").option("--pattern <pattern>", "Custom search pattern for nginx files").option("--key <key>", "API key (or NGINX_ANALYZE_TOKEN)").option("--environment <env>", "Environment name e.g. production, dev, pre (or NGINX_ANALYZE_ENVIRONMENT)").action(async (directory, options) => {
  try {
    await handleCiClientCommand(directory, options);
  } catch (error) {
    handleCiError(error);
  }
});
program.parse();
var getKey = (options) => options.key ?? process.env.NGINX_ANALYZE_TOKEN ?? null;
var getEnvironment = (options) => options.environment ?? process.env.NGINX_ANALYZE_ENVIRONMENT ?? "";
var toRelativePath = (baseDir, absolutePath) => relativePath(resolve4(baseDir), resolve4(absolutePath));
function relativePath(base, full) {
  const baseParts = base.split(/[/\\]/).filter(Boolean);
  const fullParts = full.split(/[/\\]/).filter(Boolean);
  let i = 0;
  while (i < baseParts.length && i < fullParts.length && baseParts[i] === fullParts[i]) i++;
  const rel = fullParts.slice(i).join("/");
  return rel || (fullParts[fullParts.length - 1] ?? "");
}
var buildPayload = (trees, baseDir) => {
  const files = {};
  const allAbsolutePaths = [];
  const treesPayload = trees.map((tree) => {
    const allFiles = tree.allFiles.map((absPath) => {
      const rel = toRelativePath(baseDir, absPath);
      if (!files[rel]) files[rel] = readFileSync3(absPath, "utf-8");
      allAbsolutePaths.push(absPath);
      return rel;
    });
    return { allFiles };
  });
  const sslFiles = extractSslFiles(allAbsolutePaths, baseDir);
  return { trees: treesPayload, files, sslFiles };
};
async function handleCiClientCommand(directory, options) {
  const serverUrl = "https://test.gremlingraph.com/analyze";
  const key = getKey(options);
  if (!key?.trim()) {
    console.error(chalk5.red("Missing API key. Set --key or NGINX_ANALYZE_TOKEN"));
    process.exit(EXIT_LICENSE_ERROR);
  }
  const baseUrl = serverUrl.replace(/\/$/, "");
  const analyzeUrl = `${baseUrl}/analyze`;
  console.log(chalk5.blue("CI client: discovering nginx configurations..."));
  console.log(chalk5.gray(`Directory: ${directory}`));
  if (options.strict) console.log(chalk5.gray("Mode: strict"));
  const configTrees = await findIndependentConfigTrees(directory, options);
  if (configTrees.length === 0) {
    console.log(chalk5.yellow("\nNo nginx configuration files found"));
    process.exit(EXIT_SUCCESS);
    return;
  }
  const totalFiles = configTrees.reduce((sum, t) => sum + t.allFiles.length, 0);
  console.log(chalk5.green(`
Found ${totalFiles} file(s) in ${configTrees.length} tree(s)`));
  if (options.verbose) {
    configTrees.forEach((tree, i) => {
      console.log(chalk5.cyan(`  Tree ${i + 1}: ${tree.allFiles.length} file(s)`));
    });
  }
  const baseDir = resolve4(directory);
  const { trees, files, sslFiles } = buildPayload(configTrees, baseDir);
  if (options.verbose) {
    console.log(chalk5.gray(`Sending ${trees.length} tree(s), ${Object.keys(files).length} file(s) to server`));
    if (sslFiles.length > 0) console.log(chalk5.gray(`Found ${sslFiles.length} SSL certificate reference(s)`));
  }
  const environment = getEnvironment(options);
  const body = JSON.stringify({ key, strict: Boolean(options.strict), trees, files, sslFiles, environment });
  let response;
  try {
    response = await fetch(analyzeUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk5.red(`Request failed: ${message}`));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }
  const text = await response.text();
  if (response.status === 401) {
    console.error(chalk5.red("Invalid or missing API key"));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }
  if (!response.ok) {
    let errorMessage = `Server error: ${response.status}`;
    try {
      const json = JSON.parse(text);
      if (json.error) errorMessage = json.error;
    } catch {
    }
    console.error(chalk5.red(errorMessage));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    console.error(chalk5.red("Invalid JSON response from server"));
    process.exit(EXIT_LICENSE_ERROR);
    return;
  }
  if (options.format === FORMAT_JSON) {
    console.log(JSON.stringify(result, null, 2));
    handleCiExitCode(result, options);
    return;
  }
  console.log(chalk5.cyan("\nCI Analysis Summary:"));
  console.log(chalk5.gray(`  Trees: ${result.treesAnalyzed ?? 0}`));
  console.log(chalk5.gray(`  Files: ${result.filesAnalyzed ?? 0}`));
  console.log(chalk5.gray(`  Successful: ${result.successCount ?? 0}`));
  if (Number(result.failureCount) > 0) console.log(chalk5.red(`  Failed: ${result.failureCount}`));
  displayIssues(result.issues ?? []);
  displaySummary(result);
  handleCiExitCode(result, options);
}
