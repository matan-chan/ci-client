import { describe, it, expect, afterEach } from "vitest";
import { readConfigFile, fileExists } from "../src/utils/file";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const tmp = join(tmpdir(), "nginly-client-file-utils-" + process.pid);

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

describe("readConfigFile", () => {
  it("returns the file content as a UTF-8 string", () => {
    const p = createFile("test.conf", "worker_processes 4;\nevents {}");
    expect(readConfigFile(p)).toBe("worker_processes 4;\nevents {}");
  });

  it("throws with a descriptive message when file does not exist", () => {
    expect(() => readConfigFile("/nonexistent/path/file.conf")).toThrow(
      "File not found:"
    );
  });

  it("returns empty string for an empty file", () => {
    const p = createFile("empty.conf", "");
    expect(readConfigFile(p)).toBe("");
  });
});

describe("fileExists", () => {
  it("returns true for an existing file", () => {
    const p = createFile("exists.conf", "x");
    expect(fileExists(p)).toBe(true);
  });

  it("returns false for a non-existent path", () => {
    expect(fileExists("/no/such/file.conf")).toBe(false);
  });

  it("returns true for a directory", () => {
    mkdirSync(join(tmp, "adir"), { recursive: true });
    expect(fileExists(join(tmp, "adir"))).toBe(true);
  });
});
