export const FORMAT_JSON = "json";
export const EXIT_SUCCESS = 0;
export const EXIT_WARNING = 1;
export const EXIT_ERROR = 2;
export const EXIT_FAILURE = 3;
export const EXIT_LICENSE_ERROR = 4;
export const EXIT_THRESHOLD_FAILED = 5;

export const NGINX_CONFIG_PATTERNS = ["**/nginx.conf", "**/nginx/**/*.conf", "**/*.nginx.conf", "**/conf.d/**/*.conf", "**/sites-available/**/*", "**/sites-enabled/**/*", "**/*.conf"];

export const EXCLUDE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/binaries/**"];
