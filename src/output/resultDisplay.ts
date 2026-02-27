import chalk from "chalk";
import { displayIssues, displaySummary } from "./output";
import { handleCiExitCode } from "./exitHandlers";

export const displayJsonResult = (
  result: Record<string, unknown>,
  options: Record<string, unknown>
): void => {
  console.log(JSON.stringify(result, null, 2));
  handleCiExitCode(result, options);
};

export const displayTextResult = (
  result: Record<string, unknown>,
  options: Record<string, unknown>
): void => {
  console.log(chalk.cyan("\nCI Analysis Summary:"));
  console.log(chalk.gray(`  Trees: ${result.treesAnalyzed ?? 0}`));
  console.log(chalk.gray(`  Files: ${result.filesAnalyzed ?? 0}`));
  console.log(chalk.gray(`  Successful: ${result.successCount ?? 0}`));
  if (Number(result.failureCount) > 0) console.log(chalk.red(`  Failed: ${result.failureCount}`));
  displayIssues((result.issues ?? []) as Parameters<typeof displayIssues>[0]);
  displaySummary(result as unknown as Parameters<typeof displaySummary>[0]);
  handleCiExitCode(result, options);
};
