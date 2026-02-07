import { EXIT_SUCCESS, EXIT_WARNING, EXIT_ERROR } from "./constants";
import chalk from "chalk";

export const handleCiExitCode = (result: { errorCount?: number; warningCount?: number }, options: { strict?: boolean }): void => {
  if ((result.errorCount ?? 0) > 0) {
    console.log(chalk.red(`\n✗ Analysis failed with ${result.errorCount} error(s)`));
    process.exit(EXIT_ERROR);
  }
  if ((result.warningCount ?? 0) > 0 && options.strict) {
    console.log(chalk.yellow(`\n⚠ Analysis completed with ${result.warningCount} warning(s) (strict mode)`));
    process.exit(EXIT_WARNING);
  }
  if ((result.warningCount ?? 0) > 0) {
    console.log(chalk.yellow(`\n⚠ Analysis completed with ${result.warningCount} warning(s)`));
    process.exit(EXIT_WARNING);
  }
  console.log(chalk.green("\n✓ All configurations analyzed successfully"));
  process.exit(EXIT_SUCCESS);
};
