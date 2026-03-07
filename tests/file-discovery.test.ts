import { describe, it, expect, afterEach } from "vitest";
import { isValidNginxConfig } from "../src/discovery/fileDiscovery";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tmp = join(tmpdir(), "nginly-client-tests-" + process.pid);

afterEach(() => {
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

const createFile = (name: string, content: string): string => {
  mkdirSync(tmp, { recursive: true });
  const p = join(tmp, name);
  writeFileSync(p, content, "utf-8");
  return p;
};

describe("isValidNginxConfig", () => {
  it("returns true for a normal, non-empty file", () => {
    const p = createFile("nginx.conf", "worker_processes 4;\n");
    expect(isValidNginxConfig(p)).toBe(true);
  });

  it("returns false for a non-existent path", () => {
    expect(isValidNginxConfig("/this/path/does/not/exist.conf")).toBe(false);
  });

  it("returns false for an empty file (0 bytes)", () => {
    const p = createFile("empty.conf", "");
    expect(isValidNginxConfig(p)).toBe(false);
  });

  it("returns false for a directory instead of a file", () => {
    mkdirSync(join(tmp, "mydir"), { recursive: true });
    expect(isValidNginxConfig(join(tmp, "mydir"))).toBe(false);
  });

  it("returns false for a file over 10 MB", () => {
    const p = createFile("huge.conf", "x".repeat(11 * 1024 * 1024));
    expect(isValidNginxConfig(p)).toBe(false);
  });

  it("returns true for a file exactly at 1 byte", () => {
    const p = createFile("tiny.conf", "x");
    expect(isValidNginxConfig(p)).toBe(true);
  });
});
