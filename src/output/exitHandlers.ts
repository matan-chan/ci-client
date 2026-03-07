import { EXIT_SUCCESS, EXIT_WARNING, EXIT_ERROR, EXIT_THRESHOLD_FAILED } from "../config/constants";
import chalk from "chalk";

type AnalyzeResult = {
  errorCount?: number;
  warningCount?: number;
  jobFailed?: boolean;
  hasThreshold?: boolean;
};

const hasThresholdFailure = (result: AnalyzeResult): boolean => result.jobFailed === true;

const isThresholdPassedExplicitly = (result: AnalyzeResult): boolean =>
  result.hasThreshold === true && result.jobFailed !== true;

const hasErrors = (result: AnalyzeResult): boolean => (result.errorCount ?? 0) > 0;

const hasWarnings = (result: AnalyzeResult): boolean => (result.warningCount ?? 0) > 0;

export const handleCiExitCode = (result: AnalyzeResult, options: { strict?: boolean }): void => {
  if (hasThresholdFailure(result)) {
    console.log(chalk.red("\n✗ Analysis failed: score is below configured threshold"));
    process.exit(EXIT_THRESHOLD_FAILED);
  }
  if (isThresholdPassedExplicitly(result)) {
    console.log(chalk.green("\n✓ Analysis passed: score meets configured threshold"));
    process.exit(EXIT_SUCCESS);
  }
  if (hasErrors(result)) {
    console.log(chalk.red(`\n✗ Analysis failed with ${result.errorCount} error(s)`));
    process.exit(EXIT_ERROR);
  }
  if (hasWarnings(result) && options.strict) {
    console.log(chalk.yellow(`\n⚠ Analysis completed with ${result.warningCount} warning(s) (strict mode)`));
    process.exit(EXIT_WARNING);
  }
  if (hasWarnings(result)) {
    console.log(chalk.yellow(`\n⚠ Analysis completed with ${result.warningCount} warning(s)`));
    process.exit(EXIT_WARNING);
  }
  console.log(chalk.green("\n✓ All configurations analyzed successfully"));
  process.exit(EXIT_SUCCESS);
};
