import { DEFAULT_SERVER_BASE, ANALYZE_PATH } from "./constants";

export const getKey = (options: Record<string, unknown>): string | null =>
  (options.key as string) ?? process.env.NGINX_ANALYZE_TOKEN ?? null;

export const getEnvironment = (options: Record<string, unknown>): string =>
  (options.environment as string) ?? process.env.NGINX_ANALYZE_ENVIRONMENT ?? "";

export const getAnalyzeUrl = (): string => {
  const raw = process.env.NGINX_ANALYZE_SERVER_URL?.trim() ?? process.env.NGINX_ANALYZE_URL?.trim() ?? "";
  const base = raw && raw.startsWith("http") ? raw.replace(/\/$/, "") : DEFAULT_SERVER_BASE;
  return `${base}${ANALYZE_PATH}`;
};
