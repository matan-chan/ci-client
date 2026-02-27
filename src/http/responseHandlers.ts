import { EXIT_SUCCESS, EXIT_LICENSE_ERROR, MSG_QUOTA_EXCEEDED, MSG_QUOTA_SKIPPED, MSG_SERVER_ERROR_PREFIX, MSG_INVALID_KEY, MSG_INVALID_JSON, UNKNOWN_TIER } from "../config/constants";
import chalk from "chalk";

const parseQuotaExceededMessage = (text: string): string => {
  try {
    const json = JSON.parse(text) as { error?: string; usage?: number; limit?: number; tier?: string };
    let msg = json.error ?? MSG_QUOTA_EXCEEDED;
    if (json.usage !== undefined && json.limit !== undefined) msg += ` (${json.usage}/${json.limit} used, tier: ${json.tier ?? UNKNOWN_TIER})`;
    return msg;
  } catch {
    return MSG_QUOTA_EXCEEDED;
  }
};

export const exitQuotaExceededWithWarning = (text: string): void => {
  const errorMessage = parseQuotaExceededMessage(text);
  console.warn(chalk.yellow(`\n⚠ ${errorMessage} ${MSG_QUOTA_SKIPPED}`));
  process.exit(EXIT_SUCCESS);
};

const parseErrorMessage = (text: string, status: number): string => {
  try {
    const json = JSON.parse(text) as { error?: string };
    return json.error ?? `${MSG_SERVER_ERROR_PREFIX}${status}`;
  } catch {
    return `${MSG_SERVER_ERROR_PREFIX}${status}`;
  }
};

export const exitWithServerError = (text: string, status: number): void => {
  console.error(chalk.red(parseErrorMessage(text, status)));
  process.exit(EXIT_LICENSE_ERROR);
};

export const exitInvalidKey = (): void => {
  console.error(chalk.red(MSG_INVALID_KEY));
  process.exit(EXIT_LICENSE_ERROR);
};

export const parseJsonOrExit = (text: string): Record<string, unknown> => {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error(chalk.red(MSG_INVALID_JSON));
    process.exit(EXIT_LICENSE_ERROR);
  }
};

export const handleAnalyzeResponse = (response: Response, text: string, options: Record<string, unknown>): Record<string, unknown> => {
  if (response.status === 401) exitInvalidKey();
  if (response.status === 402 && options.allowQuotaExceeded) exitQuotaExceededWithWarning(text);
  if (!response.ok) exitWithServerError(text, response.status);
  return parseJsonOrExit(text);
};
