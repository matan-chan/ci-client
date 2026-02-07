import { NGINX_CONFIG_PATTERNS, EXCLUDE_PATTERNS } from "./constants";
import { dirname, isAbsolute, join, resolve } from "path";
import { readConfigFile } from "./utils/file";
import { parseNginxConfig } from "./parser";
import { logVerbose } from "./utils";
import { existsSync, statSync } from "fs";
import { glob } from "glob";
import chalk from "chalk";

export interface ConfigTree {
  rootFiles: string[];
  allFiles: string[];
  dependencyGraph: Map<string, Set<string>>;
}

export const findNginxConfigs = async (directory: string, options: { pattern?: string; verbose?: boolean }): Promise<string[]> => {
  logVerbose(() => console.log(chalk.gray(`\nSearching for nginx configs in: ${directory}`)), options.verbose ?? false);
  const patterns = options.pattern ? [options.pattern] : NGINX_CONFIG_PATTERNS;
  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: directory, absolute: true, ignore: EXCLUDE_PATTERNS, nodir: true });
    allFiles.push(...files);
  }
  const uniqueFiles = [...new Set(allFiles)];
  const validFiles = uniqueFiles.filter(isValidNginxConfig);
  logVerbose(() => console.log(chalk.gray(`Found ${validFiles.length} nginx config files`)), options.verbose ?? false);
  return validFiles;
};

export const findIndependentConfigTrees = async (directory: string, options: { pattern?: string; verbose?: boolean }): Promise<ConfigTree[]> => {
  const allConfigFiles = await findNginxConfigs(directory, options);
  if (allConfigFiles.length === 0) return [];
  const dependencyGraph = await buildDependencyGraph(allConfigFiles);
  const trees = findConnectedComponents(allConfigFiles, dependencyGraph);
  logVerbose(() => {
    console.log(chalk.gray(`\nFound ${trees.length} independent config tree(s):`));
    trees.forEach((tree, index) => {
      console.log(chalk.gray(`  Tree ${index + 1}: ${tree.rootFiles.length} root file(s), ${tree.allFiles.length} total file(s)`));
    });
  }, options.verbose ?? false);
  return trees;
};

const buildDependencyGraph = async (files: string[]): Promise<Map<string, Set<string>>> => {
  const graph = new Map<string, Set<string>>();
  for (const file of files) {
    const dependencies = await extractIncludeDependencies(file, files);
    graph.set(file, dependencies);
  }
  return graph;
};

const extractIncludeDependencies = async (filePath: string, allFiles: string[]): Promise<Set<string>> => {
  const dependencies = new Set<string>();
  try {
    const content = readConfigFile(filePath);
    const ast = parseNginxConfig(content);
    const baseDir = dirname(resolve(filePath));
    const includePaths = findIncludeDirectives(ast);
    for (const includePath of includePaths) {
      const resolvedPaths = resolveIncludePath(includePath, baseDir);
      for (const resolvedPath of resolvedPaths) {
        if (allFiles.includes(resolvedPath)) dependencies.add(resolvedPath);
      }
    }
  } catch {
    // parsing failed, treat as no dependencies
  }
  return dependencies;
};

const findIncludeDirectives = (ast: { children?: { type: string; name?: string; args?: string[]; children?: unknown[] }[] }): string[] => {
  const includePaths: string[] = [];
  const traverse = (nodes: { type: string; name?: string; args?: string[]; children?: unknown[] }[] | undefined): void => {
    if (!nodes) return;
    for (const node of nodes) {
      if (node.type === "directive" && node.name === "include" && node.args && node.args.length > 0) includePaths.push(node.args[0]);
      if (node.children) traverse(node.children as { type: string; name?: string; args?: string[]; children?: unknown[] }[]);
    }
  };
  traverse(ast.children);
  return includePaths;
};

const resolveIncludePath = (includePath: string, baseDir: string): string[] => {
  if (hasGlobPattern(includePath)) {
    const pattern = isAbsolute(includePath) ? includePath : join(baseDir, includePath);
    return resolveGlobPattern(pattern);
  }
  const fullPath = isAbsolute(includePath) ? includePath : join(baseDir, includePath);
  if (existsSync(fullPath)) return [fullPath];
  return [];
};

const hasGlobPattern = (path: string): boolean => path.includes("*") || path.includes("?") || path.includes("[");

const resolveGlobPattern = (pattern: string): string[] => {
  try {
    const matches = glob.sync(pattern, { absolute: true, nodir: true, windowsPathsNoEscape: true });
    return matches.sort();
  } catch {
    return [];
  }
};

const findConnectedComponents = (allFiles: string[], dependencyGraph: Map<string, Set<string>>): ConfigTree[] => {
  const visited = new Set<string>();
  const trees: ConfigTree[] = [];
  for (const file of allFiles) {
    if (visited.has(file)) continue;
    const component = findComponent(file, dependencyGraph, visited);
    const rootFiles = findRootFiles(component, dependencyGraph);
    trees.push({ rootFiles, allFiles: component, dependencyGraph });
  }
  return trees;
};

const findComponent = (startFile: string, graph: Map<string, Set<string>>, visited: Set<string>): string[] => {
  const component: string[] = [];
  const queue = [startFile];
  const reverseGraph = buildReverseGraph(graph);
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    component.push(file);
    const dependencies = graph.get(file) || new Set();
    for (const dep of dependencies) {
      if (!visited.has(dep)) queue.push(dep);
    }
    const dependents = reverseGraph.get(file) || new Set();
    for (const dependent of dependents) {
      if (!visited.has(dependent)) queue.push(dependent);
    }
  }
  return component;
};

const buildReverseGraph = (graph: Map<string, Set<string>>): Map<string, Set<string>> => {
  const reverse = new Map<string, Set<string>>();
  for (const [file, deps] of graph.entries()) {
    if (!reverse.has(file)) reverse.set(file, new Set());
    for (const dep of deps) {
      if (!reverse.has(dep)) reverse.set(dep, new Set());
      reverse.get(dep)!.add(file);
    }
  }
  return reverse;
};

const findRootFiles = (component: string[], graph: Map<string, Set<string>>): string[] => {
  const reverseGraph = buildReverseGraph(graph);
  const rootFiles: string[] = [];
  for (const file of component) {
    const dependents = reverseGraph.get(file) || new Set();
    const hasDependentsInComponent = Array.from(dependents).some((dep) => component.includes(dep));
    if (!hasDependentsInComponent) rootFiles.push(file);
  }
  return rootFiles.length > 0 ? rootFiles : [component[0]!];
};

export const isValidNginxConfig = (filePath: string): boolean => {
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
