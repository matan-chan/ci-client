import { existsSync, statSync, readFileSync } from "fs";
import type { ASTNode, Config } from "./parser/ast";
import { dirname, resolve, relative } from "path";
import { tokenize } from "./parser/lexer";
import { Parser } from "./parser/parser";

export type SslFileInfo = {
  path: string;
  exists: boolean;
  directive: "ssl_certificate" | "ssl_certificate_key";
  referencedIn: string;
};

const SSL_DIRECTIVE_NAMES: (SslFileInfo["directive"])[] = [
  "ssl_certificate",
  "ssl_certificate_key",
];

export const extractSslFiles = (
  configFiles: string[],
  baseDir: string
): SslFileInfo[] => {
  const results: SslFileInfo[] = [];
  const seenKeys = new Set<string>();

  for (const absoluteConfigPath of configFiles) {
    const infos = getSslInfosFromConfigFile(absoluteConfigPath, baseDir);
    for (const info of infos) {
      const key = `${info.path}:${info.directive}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        results.push(info);
      }
    }
  }
  return results;
};

const getSslInfosFromConfigFile = (
  absoluteConfigPath: string,
  baseDir: string
): SslFileInfo[] => {
  const ast = parseConfigFile(absoluteConfigPath);
  if (!ast) return [];
  const relativePath = relative(baseDir, absoluteConfigPath);
  const rawResults: SslFileInfo[] = [];

  for (const node of ast.children)
    extractSslDirectivesFromNode(node, absoluteConfigPath, rawResults);

  return rawResults
    .map((sslFile) =>
      toRelativeSslInfo(sslFile, absoluteConfigPath, baseDir, relativePath)
    )
    .filter((info): info is SslFileInfo => info !== null);
};

const extractSslDirectivesFromNode = (
  node: ASTNode,
  configFile: string,
  results: SslFileInfo[]
): void => {
  if (node.type === "directive") {
    const name = node.name;
    if (SSL_DIRECTIVE_NAMES.includes(name as SslFileInfo["directive"])) {
      const sslFilePath = node.args[0];
      if (sslFilePath) {
        const exists = fileExists(sslFilePath, configFile);
        results.push({
          path: sslFilePath,
          exists,
          directive: name as SslFileInfo["directive"],
          referencedIn: configFile,
        });
      }
    }
  }
  if (node.type === "block")
    for (const child of node.children)
      extractSslDirectivesFromNode(child, configFile, results);
};

const toRelativeSslInfo = (
  sslFile: SslFileInfo,
  absoluteConfigPath: string,
  baseDir: string,
  relativeReferencedIn: string
): SslFileInfo | null => {
  const absoluteSslPath = resolvePath(sslFile.path, absoluteConfigPath);
  if (!absoluteSslPath) return null;
  const relativeSslPath = relative(baseDir, absoluteSslPath);
  return {
    path: relativeSslPath,
    exists: sslFile.exists,
    directive: sslFile.directive,
    referencedIn: relativeReferencedIn,
  };
};

const parseConfigFile = (absolutePath: string): Config | null => {
  try {
    const content = readFileSync(absolutePath, "utf-8");
    const tokens = tokenize(content);
    const parser = new Parser(tokens);
    return parser.parse();
  } catch {
    return null;
  }
};

const fileExists = (filePath: string, baseFile: string): boolean => {
  const absolutePath = resolvePath(filePath, baseFile);
  if (!absolutePath) return false;
  try {
    return existsSync(absolutePath) && statSync(absolutePath).isFile();
  } catch {
    return false;
  }
};

const resolvePath = (filePath: string, baseFile: string): string | null => {
  try {
    const baseDir = dirname(resolve(baseFile));
    return resolve(baseDir, filePath);
  } catch {
    return null;
  }
};
