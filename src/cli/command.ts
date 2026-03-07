import { resolve } from "path";
import chalk from "chalk";
import { findIndependentConfigTrees } from "../discovery/fileDiscovery";
import { buildPayload } from "../discovery/payload";
import { chunkPayload } from "../discovery/chunkPayload";
import { FORMAT_JSON, EXIT_LICENSE_ERROR, MSG_MISSING_KEY } from "../config/constants";
import { getKey, getEnvironment, getAnalyzeUrl } from "../config/options";
import {
  logDiscoveryStart,
  logNoConfigsAndExit,
  logConfigTreesFound,
  logSendingPayload,
} from "../output/logger";
import { sendAnalyzeRequest } from "../http/request";
import { handleAnalyzeResponse } from "../http/responseHandlers";
import { displayJsonResult, displayTextResult } from "../output/resultDisplay";

const ensureKeyExists = (options: Record<string, unknown>): void => {
  const key = getKey(options);
  if (!key?.trim()) {
    console.error(chalk.red(MSG_MISSING_KEY));
    process.exit(EXIT_LICENSE_ERROR);
  }
};

export const handleCiClientCommand = async (
  directory: string,
  options: Record<string, unknown>
): Promise<void> => {
  ensureKeyExists(options);
  const analyzeUrl = getAnalyzeUrl();
  logDiscoveryStart(directory, options, analyzeUrl);

  const { trees: configTrees, fileContents } = await findIndependentConfigTrees(
    directory,
    options as { pattern?: string; verbose?: boolean }
  );
  if (configTrees.length === 0) return logNoConfigsAndExit();

  logConfigTreesFound(configTrees, options);
  const baseDir = resolve(directory);
  const { trees, files, sslFiles } = buildPayload(configTrees, baseDir, fileContents);
  logSendingPayload(trees, files, sslFiles, options);

  const key = getKey(options)!;
  const environment = getEnvironment(options);
  const chunks = chunkPayload(trees, files, sslFiles);
  const totalBatches = chunks.length;

  let lastResponse: Response | null = null;
  let lastText = "";
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const body = JSON.stringify({
      key,
      strict: Boolean(options.strict),
      trees: chunk.trees,
      files: chunk.files,
      sslFiles: chunk.sslFiles,
      environment,
      ...(totalBatches > 1 && { batchIndex: i, totalBatches }),
    });
    if (options.verbose && totalBatches > 1) {
      console.log(chalk.gray(`Sending batch ${i + 1}/${totalBatches} (${chunk.trees.length} trees)`));
    }
    const { response, text } = await sendAnalyzeRequest(analyzeUrl, body);
    lastResponse = response;
    lastText = text;
  }

  const result = handleAnalyzeResponse(lastResponse!, lastText, options);

  if (options.format === FORMAT_JSON) return displayJsonResult(result, options);
  displayTextResult(result, options);
};
