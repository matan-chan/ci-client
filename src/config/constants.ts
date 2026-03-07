export const FORMAT_JSON = "json";
export const EXIT_SUCCESS = 0;
export const EXIT_WARNING = 1;
export const EXIT_ERROR = 2;
export const EXIT_FAILURE = 3;
export const EXIT_LICENSE_ERROR = 4;
export const EXIT_THRESHOLD_FAILED = 5;

export const NGINX_CONFIG_PATTERNS = ["**/nginx.conf", "**/nginx/**/*.conf", "**/*.nginx.conf", "**/conf.d/**/*.conf", "**/sites-available/**/*", "**/sites-enabled/**/*", "**/*.conf"];

export const EXCLUDE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/binaries/**"];

export const MSG_MISSING_KEY = "Missing API key. Set --key or NGINX_ANALYZE_TOKEN";
export const MSG_INVALID_KEY = "Invalid or missing API key";
export const MSG_QUOTA_EXCEEDED = "Usage limit exceeded for this billing period.";
export const MSG_QUOTA_SKIPPED = "Analysis skipped. Job passed with --allow-quota-exceeded.";
export const MSG_SERVER_ERROR_PREFIX = "Server error: ";
export const MSG_INVALID_JSON = "Invalid JSON response from server";
export const DEFAULT_SERVER_BASE = "https://nginly.com";
export const ANALYZE_PATH = "/analyze";
export const UNKNOWN_TIER = "unknown";
