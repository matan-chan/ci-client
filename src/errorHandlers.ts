import { EXIT_FAILURE } from "./constants";
import chalk from "chalk";

export const handleCiError = (error: unknown): void => {
  console.error(chalk.red("\n✗ CI analysis failed"));
  if (error instanceof Error) console.error(chalk.gray(error.message));
  process.exit(EXIT_FAILURE);
};
