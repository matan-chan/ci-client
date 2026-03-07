import { describe, it, expect, vi, afterEach } from "vitest";
import { handleCiExitCode } from "../src/output/exitHandlers";

const mockExit = () =>
  vi.spyOn(process, "exit").mockImplementation((code) => {
    throw new Error(`EXIT:${code}`);
  });

afterEach(() => vi.restoreAllMocks());

describe("handleCiExitCode", () => {
  it("exits with 5 (THRESHOLD_FAILED) when jobFailed is true", () => {
    const spy = mockExit();
    expect(() => handleCiExitCode({ jobFailed: true }, {})).toThrow("EXIT:5");
    expect(spy).toHaveBeenCalledWith(5);
  });

  it("exits with 0 when threshold is set and job did not fail", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ hasThreshold: true, jobFailed: false }, {})
    ).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("jobFailed=true takes priority over errorCount", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ jobFailed: true, errorCount: 5 }, {})
    ).toThrow("EXIT:5");
    expect(spy).toHaveBeenCalledWith(5);
  });

  it("exits with 2 (ERROR) when there are errors", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ errorCount: 3, jobFailed: false }, {})
    ).toThrow("EXIT:2");
    expect(spy).toHaveBeenCalledWith(2);
  });

  it("exits with 1 (WARNING) in strict mode when there are only warnings", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ warningCount: 2 }, { strict: true })
    ).toThrow("EXIT:1");
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("exits with 1 (WARNING) even without strict when warnings present", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ warningCount: 1 }, {})
    ).toThrow("EXIT:1");
    expect(spy).toHaveBeenCalledWith(1);
  });

  it("exits with 0 (SUCCESS) when no issues exist", () => {
    const spy = mockExit();
    expect(() =>
      handleCiExitCode({ errorCount: 0, warningCount: 0 }, {})
    ).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });

  it("exits with 0 when result is empty object", () => {
    const spy = mockExit();
    expect(() => handleCiExitCode({}, {})).toThrow("EXIT:0");
    expect(spy).toHaveBeenCalledWith(0);
  });
});
