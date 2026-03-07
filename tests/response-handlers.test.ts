import { describe, it, expect, vi, afterEach } from "vitest";
import {
  handleAnalyzeResponse,
  parseJsonOrExit,
  exitInvalidKey,
  exitWithServerError,
  exitQuotaExceededWithWarning,
} from "../src/http/responseHandlers";

const mockExit = () =>
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

const makeResponse = (status: number, ok = status >= 200 && status < 300): Response =>
  ({ status, ok }) as Response;

afterEach(() => vi.restoreAllMocks());

describe("parseJsonOrExit", () => {
  it("returns parsed object for valid JSON", () => {
    const result = parseJsonOrExit('{"score": 95, "issues": []}');
    expect(result).toEqual({ score: 95, issues: [] });
  });

  it("exits with code 4 for malformed JSON", () => {
    const spy = mockExit();
    expect(() => parseJsonOrExit("not json {{")).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });

  it("exits with code 4 for empty string", () => {
    mockExit();
    expect(() => parseJsonOrExit("")).toThrow("EXIT:4");
  });
});

describe("exitInvalidKey", () => {
  it("exits with code 4", () => {
    const spy = mockExit();
    expect(() => exitInvalidKey()).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });
});

describe("exitWithServerError", () => {
  it("exits with code 4", () => {
    const spy = mockExit();
    expect(() => exitWithServerError('{"error":"rate limited"}', 429)).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });
});

describe("exitQuotaExceededWithWarning", () => {
  it("exits with code 0 (not a failure)", () => {
    const spy = mockExit();
    expect(() =>
      exitQuotaExceededWithWarning(
        '{"error":"quota exceeded","usage":100,"limit":100,"tier":"free"}'
      )
    ).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("exits with code 0 even for malformed quota JSON", () => {
    const spy = mockExit();
    expect(() => exitQuotaExceededWithWarning("bad json")).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });
});

describe("handleAnalyzeResponse", () => {
  it("routes 401 to exitInvalidKey (exit 4)", () => {
    const spy = mockExit();
    expect(() =>
      handleAnalyzeResponse(makeResponse(401), "", {})
    ).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });

  it("routes 402 with allowQuotaExceeded flag to quota warning (exit 0)", () => {
    const spy = mockExit();
    expect(() =>
      handleAnalyzeResponse(makeResponse(402), '{"error":"limit"}', {
        allowQuotaExceeded: true,
      })
    ).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("treats 402 WITHOUT flag as server error (exit 4)", () => {
    const spy = mockExit();
    expect(() =>
      handleAnalyzeResponse(makeResponse(402), '{"error":"limit"}', {})
    ).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });

  it("routes 500 to server error (exit 4)", () => {
    const spy = mockExit();
    expect(() =>
      handleAnalyzeResponse(makeResponse(500, false), '{"error":"oops"}', {})
    ).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });

  it("returns parsed result on 200 OK", () => {
    mockExit();
    const result = handleAnalyzeResponse(
      makeResponse(200),
      '{"overallScore": 87, "issues": []}',
      {}
    );
    expect(result).toEqual({ overallScore: 87, issues: [] });
  });

  it("exits with 4 on 200 with invalid JSON body", () => {
    const spy = mockExit();
    expect(() =>
      handleAnalyzeResponse(makeResponse(200), "invalid", {})
    ).toThrow("EXIT:4");
    expect(spy).toHaveBeenCalledWith(4);
  });
});
