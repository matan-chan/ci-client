import { EXIT_LICENSE_ERROR } from "../config/constants";
import chalk from "chalk";

export const sendAnalyzeRequest = async (analyzeUrl: string, body: string): Promise<{ response: Response; text: string }> => {
  try {
    const response = await fetch(analyzeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const text = await response.text();
    return { response, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Request failed: ${message}`));
    process.exit(EXIT_LICENSE_ERROR);
  }
};
