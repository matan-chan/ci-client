import type { SslFileInfo } from "./sslFileDetector";

const CHUNK_SIZE_BYTES = 1500 * 1024;

export type ChunkPayload = {
  trees: { allFiles: string[] }[];
  files: Record<string, string>;
  sslFiles: SslFileInfo[];
};

const estimateSize = (chunk: ChunkPayload): number =>
  Buffer.byteLength(JSON.stringify(chunk), "utf-8");

const sslFilesForFilePaths = (sslFiles: SslFileInfo[], filePaths: Set<string>): SslFileInfo[] =>
  sslFiles.filter((s) => filePaths.has(s.referencedIn));

export const chunkPayload = (
  trees: { allFiles: string[] }[],
  files: Record<string, string>,
  sslFiles: SslFileInfo[]
): ChunkPayload[] => {
  if (trees.length === 0) return [];
  const chunks: ChunkPayload[] = [];
  let currentTrees: { allFiles: string[] }[] = [];
  let currentFiles: Record<string, string> = {};

  const flushChunk = () => {
    if (currentTrees.length === 0) return;
    const filePaths = new Set(currentTrees.flatMap((t) => t.allFiles));
    chunks.push({
      trees: [...currentTrees],
      files: { ...currentFiles },
      sslFiles: sslFilesForFilePaths(sslFiles, filePaths),
    });
    currentTrees = [];
    currentFiles = {};
  };

  for (const tree of trees) {
    const nextTrees = [...currentTrees, tree];
    const nextFiles = { ...currentFiles };
    for (const p of tree.allFiles) {
      if (files[p] !== undefined) nextFiles[p] = files[p];
    }
    const candidate: ChunkPayload = {
      trees: nextTrees,
      files: nextFiles,
      sslFiles: sslFilesForFilePaths(sslFiles, new Set(nextTrees.flatMap((t) => t.allFiles))),
    };
    const size = estimateSize(candidate);
    if (size > CHUNK_SIZE_BYTES && currentTrees.length > 0) {
      flushChunk();
      const singleFiles: Record<string, string> = {};
      for (const p of tree.allFiles) {
        if (files[p] !== undefined) singleFiles[p] = files[p];
      }
      const single: ChunkPayload = {
        trees: [tree],
        files: singleFiles,
        sslFiles: sslFilesForFilePaths(sslFiles, new Set(tree.allFiles)),
      };
      if (estimateSize(single) > CHUNK_SIZE_BYTES) chunks.push(single);
      else {
        currentTrees = [tree];
        currentFiles = singleFiles;
      }
    } else {
      currentTrees = nextTrees;
      currentFiles = nextFiles;
    }
  }
  flushChunk();
  return chunks;
};
