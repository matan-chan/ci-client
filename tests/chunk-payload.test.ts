import { describe, it, expect } from "vitest";
import { chunkPayload } from "../src/discovery/chunkPayload";

const makeTree = (files: string[]) => ({ allFiles: files });
const makeFiles = (paths: string[], contentSize = 10) =>
  Object.fromEntries(paths.map((p) => [p, "x".repeat(contentSize)]));

describe("chunkPayload", () => {
  it("returns empty array when trees is empty", () => {
    expect(chunkPayload([], {}, [])).toEqual([]);
  });

  it("puts all small trees into a single chunk", () => {
    const trees = [
      makeTree(["a.conf"]),
      makeTree(["b.conf"]),
      makeTree(["c.conf"]),
    ];
    const files = makeFiles(["a.conf", "b.conf", "c.conf"]);
    const chunks = chunkPayload(trees, files, []);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].trees).toHaveLength(3);
  });

  it("single tree is always emitted even if it exceeds the size limit", () => {
    const bigContent = "x".repeat(2 * 1024 * 1024); // 2 MB — over 1.5 MB limit
    const tree = makeTree(["huge.conf"]);
    const files = { "huge.conf": bigContent };
    const chunks = chunkPayload([tree], files, []);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].trees[0]).toEqual(tree);
  });

  it("splits trees across multiple chunks when combined size exceeds limit", () => {
    const bigContent = "x".repeat(800 * 1024); // 800 KB each — two fit but three don't
    const trees = [
      makeTree(["a.conf"]),
      makeTree(["b.conf"]),
      makeTree(["c.conf"]),
    ];
    const files = { "a.conf": bigContent, "b.conf": bigContent, "c.conf": bigContent };
    const chunks = chunkPayload(trees, files, []);
    expect(chunks.length).toBeGreaterThan(1);
    const allTreesInChunks = chunks.flatMap((c) => c.trees);
    expect(allTreesInChunks).toHaveLength(3);
  });

  it("each chunk only contains files referenced by its own trees", () => {
    const trees = [makeTree(["a.conf"]), makeTree(["b.conf"])];
    const files = { "a.conf": "aaa", "b.conf": "bbb" };
    const chunks = chunkPayload(trees, files, []);
    for (const chunk of chunks) {
      const allPaths = chunk.trees.flatMap((t) => t.allFiles);
      for (const path of Object.keys(chunk.files))
        expect(allPaths).toContain(path);
    }
  });

  it("associates ssl files with the correct chunk", () => {
    const trees = [makeTree(["a.conf"]), makeTree(["b.conf"])];
    const files = makeFiles(["a.conf", "b.conf"]);
    const sslFiles = [
      { path: "ssl/a.pem", directive: "ssl_certificate", referencedIn: "a.conf", exists: true },
      { path: "ssl/b.pem", directive: "ssl_certificate", referencedIn: "b.conf", exists: true },
    ];
    const chunks = chunkPayload(trees, files, sslFiles);
    const allSsl = chunks.flatMap((c) => c.sslFiles);
    expect(allSsl).toHaveLength(2);
  });

  it("does not include ssl files whose referencedIn is not in the chunk", () => {
    const trees = [makeTree(["a.conf"])];
    const files = makeFiles(["a.conf"]);
    const sslFiles = [
      { path: "ssl/x.pem", directive: "ssl_certificate", referencedIn: "other.conf", exists: true },
    ];
    const chunks = chunkPayload(trees, files, sslFiles);
    expect(chunks[0].sslFiles).toHaveLength(0);
  });

  it("handles trees with multiple files in allFiles array", () => {
    const trees = [makeTree(["main.conf", "server.conf"])];
    const files = makeFiles(["main.conf", "server.conf"]);
    const chunks = chunkPayload(trees, files, []);
    expect(chunks).toHaveLength(1);
    expect(Object.keys(chunks[0].files)).toEqual(
      expect.arrayContaining(["main.conf", "server.conf"])
    );
  });
});
