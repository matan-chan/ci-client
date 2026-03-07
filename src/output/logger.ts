import chalk from "chalk";
import { EXIT_SUCCESS } from "../config/constants";
import type { ConfigTree } from "../discovery/fileDiscovery";
import type { SslFileInfo } from "../discovery/sslFileDetector";

export const logDiscoveryStart = (
  directory: string,
  options: Record<string, unknown>,
  analyzeUrl: string
): void => {
  console.log(chalk.blue("CI client: discovering nginx configurations..."));
  console.log(chalk.gray(`Directory: ${directory}`));
  if (options.verbose) console.log(chalk.gray(`Server: ${analyzeUrl}`));
  if (options.strict) console.log(chalk.gray("Mode: strict"));
  if (options.allowQuotaExceeded) console.log(chalk.gray("Mode: allow-quota-exceeded"));
};

export const logNoConfigsAndExit = (): void => {
  console.log(chalk.yellow("\nNo nginx configuration files found"));
  process.exit(EXIT_SUCCESS);
};

export const logConfigTreesFound = (
  configTrees: ConfigTree[],
  options: Record<string, unknown>
): void => {
  const totalFiles = configTrees.reduce((sum, t) => sum + t.allFiles.length, 0);
  console.log(chalk.green(`\nFound ${totalFiles} file(s) in ${configTrees.length} tree(s)`));
  if (options.verbose)
    configTrees.forEach((tree, i) =>
      console.log(chalk.cyan(`  Tree ${i + 1}: ${tree.allFiles.length} file(s)`))
    );
};

export const logSendingPayload = (
  trees: { allFiles: string[] }[],
  files: Record<string, string>,
  sslFiles: SslFileInfo[],
  options: Record<string, unknown>
): void => {
  if (!options.verbose) return;
  console.log(chalk.gray(`Sending ${trees.length} tree(s), ${Object.keys(files).length} file(s) to server`));
  if (sslFiles.length > 0) console.log(chalk.gray(`Found ${sslFiles.length} SSL certificate reference(s)`));
};
