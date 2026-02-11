import { existsSync, statSync, readFileSync } from "fs";
import { dirname, resolve, relative } from "path";
import { tokenize } from "./parser/lexer";
import { Parser } from "./parser/parser";
import type { ASTNode, Config } from "./parser/ast";

export type SslFileInfo = {
  path: string;
  exists: boolean;
  directive: "ssl_certificate" | "ssl_certificate_key";
  referencedIn: string;
};

const SSL_DIRECTIVES = ["ssl_certificate", "ssl_certificate_key"] as const;

const resolvePath = (filePath: string, baseFile: string): string | null => {
  try {
    const baseDir = dirname(resolve(baseFile));
    return resolve(baseDir, filePath);
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

const extractSslDirectivesFromNode = (
  node: ASTNode,
  configFile: string,
  results: SslFileInfo[]
): void => {
  if (node.type === "directive" && SSL_DIRECTIVES.includes(node.name as any)) {
    const directive = node.name as "ssl_certificate" | "ssl_certificate_key";
    const sslFilePath = node.args[0];
    
    if (sslFilePath) {
      const absolutePath = resolvePath(sslFilePath, configFile);
      const exists = fileExists(sslFilePath, configFile);
      
      results.push({
        path: sslFilePath,
        exists,
        directive,
        referencedIn: configFile,
      });
    }
  }

  if (node.type === "block") {
    for (const child of node.children) {
      extractSslDirectivesFromNode(child, configFile, results);
    }
  }
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

export const extractSslFiles = (
  configFiles: string[],
  baseDir: string
): SslFileInfo[] => {
  const results: SslFileInfo[] = [];
  const seen = new Set<string>();

  for (const absoluteConfigPath of configFiles) {
    const ast = parseConfigFile(absoluteConfigPath);
    if (!ast) continue;

    const relativePath = relative(baseDir, absoluteConfigPath);
    const tempResults: SslFileInfo[] = [];

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
          referencedIn: relativePath,
        });
      }
    }
  }

  return results;
};
