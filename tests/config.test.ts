import { describe, it, expect, afterEach } from "vitest";
import { getKey, getEnvironment, getAnalyzeUrl } from "../src/config/options";

const saved = { ...process.env };

afterEach(() => {
  process.env.NGINX_ANALYZE_TOKEN = saved.NGINX_ANALYZE_TOKEN;
  process.env.NGINX_ANALYZE_ENVIRONMENT = saved.NGINX_ANALYZE_ENVIRONMENT;
  process.env.NGINX_ANALYZE_SERVER_URL = saved.NGINX_ANALYZE_SERVER_URL;
  process.env.NGINX_ANALYZE_URL = saved.NGINX_ANALYZE_URL;
  delete process.env.NGINX_ANALYZE_TOKEN;
  delete process.env.NGINX_ANALYZE_ENVIRONMENT;
  delete process.env.NGINX_ANALYZE_SERVER_URL;
  delete process.env.NGINX_ANALYZE_URL;
});

describe("getKey", () => {
  it("returns options.key when explicitly provided", () => {
    expect(getKey({ key: "my-key-123" })).toBe("my-key-123");
  });

  it("falls back to NGINX_ANALYZE_TOKEN env var when options.key absent", () => {
    process.env.NGINX_ANALYZE_TOKEN = "env-token";
    expect(getKey({})).toBe("env-token");
  });

  it("returns null when neither options.key nor env var is set", () => {
    delete process.env.NGINX_ANALYZE_TOKEN;
    expect(getKey({})).toBeNull();
  });

  it("prefers options.key over env var", () => {
    process.env.NGINX_ANALYZE_TOKEN = "env-token";
    expect(getKey({ key: "explicit-key" })).toBe("explicit-key");
  });
});

describe("getEnvironment", () => {
  it("returns options.environment when provided", () => {
    expect(getEnvironment({ environment: "production" })).toBe("production");
  });

  it("falls back to NGINX_ANALYZE_ENVIRONMENT env var", () => {
    process.env.NGINX_ANALYZE_ENVIRONMENT = "staging";
    expect(getEnvironment({})).toBe("staging");
  });

  it("returns empty string when neither is set", () => {
    delete process.env.NGINX_ANALYZE_ENVIRONMENT;
    expect(getEnvironment({})).toBe("");
  });
});

describe("getAnalyzeUrl", () => {
  it("returns default production URL when no env var set", () => {
    delete process.env.NGINX_ANALYZE_SERVER_URL;
    delete process.env.NGINX_ANALYZE_URL;
    expect(getAnalyzeUrl()).toBe("https://nginly.com/analyze");
  });

  it("uses NGINX_ANALYZE_SERVER_URL when it starts with http", () => {
    process.env.NGINX_ANALYZE_SERVER_URL = "http://localhost:4000";
    delete process.env.NGINX_ANALYZE_URL;
    expect(getAnalyzeUrl()).toBe("http://localhost:4000/analyze");
  });

  it("strips trailing slash from server URL", () => {
    process.env.NGINX_ANALYZE_SERVER_URL = "https://myserver.com/";
    expect(getAnalyzeUrl()).toBe("https://myserver.com/analyze");
  });

  it("falls back to NGINX_ANALYZE_URL when SERVER_URL not set", () => {
    delete process.env.NGINX_ANALYZE_SERVER_URL;
    process.env.NGINX_ANALYZE_URL = "https://custom.api.com";
    expect(getAnalyzeUrl()).toBe("https://custom.api.com/analyze");
  });

  it("ignores env var that does not start with http (uses default)", () => {
    process.env.NGINX_ANALYZE_SERVER_URL = "localhost:4000";
    expect(getAnalyzeUrl()).toBe("https://nginly.com/analyze");
  });
});
