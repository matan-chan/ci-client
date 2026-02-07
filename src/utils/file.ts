import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

export const readConfigFile = (filePath: string): string => {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) throw new Error(`File not found: ${filePath}`);
  return readFileSync(absolutePath, "utf-8");
};

export const fileExists = (filePath: string): boolean => existsSync(resolve(filePath));
