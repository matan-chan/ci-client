import { extractSslFiles, type SslFileInfo } from "./sslFileDetector";
import { type ConfigTree } from "./fileDiscovery";
import { readFileSync } from "fs";
import { resolve } from "path";

const relativePath = (base: string, full: string): string => {
  const baseParts = base.split(/[/\\]/).filter(Boolean);
  const fullParts = full.split(/[/\\]/).filter(Boolean);
  let i = 0;
  while (i < baseParts.length && i < fullParts.length && baseParts[i] === fullParts[i]) i++;
  const rel = fullParts.slice(i).join("/");
  return rel || (fullParts[fullParts.length - 1] ?? "");
};

const toRelativePath = (baseDir: string, absolutePath: string): string => relativePath(resolve(baseDir), resolve(absolutePath));

export const buildPayload = (trees: ConfigTree[], baseDir: string, fileContents: Map<string, string>): { trees: { allFiles: string[] }[]; files: Record<string, string>; sslFiles: SslFileInfo[] } => {
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
