import { brotliCompressSync, constants } from "zlib";
import { EXIT_LICENSE_ERROR } from "../config/constants";
import chalk from "chalk";

const COMPRESS_THRESHOLD_BYTES = 1024;

const compressPayload = (buf: Buffer): { body: Buffer; encoding: string } => {
  if (buf.length < COMPRESS_THRESHOLD_BYTES) return { body: buf, encoding: "identity" };
  const brotli = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } });
  return brotli.length < buf.length ? { body: brotli, encoding: "br" } : { body: buf, encoding: "identity" };
};

const sendWithPayload = (analyzeUrl: string, payload: Buffer, encoding: string) => {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (encoding !== "identity") headers["Content-Encoding"] = encoding;
  return fetch(analyzeUrl, {
    method: "POST",
    headers,
    body: new Uint8Array(payload),
  });
};

export const sendAnalyzeRequest = async (analyzeUrl: string, body: string): Promise<{ response: Response; text: string }> => {
  try {
    const buf = Buffer.from(body, "utf-8");
    const { body: payload, encoding } = compressPayload(buf);
    let response = await sendWithPayload(analyzeUrl, payload, encoding);
    if (response.status === 415 && encoding !== "identity") {
      response = await sendWithPayload(analyzeUrl, buf, "identity");
    }
    const text = await response.text();
    return { response, text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Request failed: ${message}`));
    process.exit(EXIT_LICENSE_ERROR);
  }
};
