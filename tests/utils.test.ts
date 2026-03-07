import { describe, it, expect, vi } from "vitest";
import { logVerbose } from "../src/utils";

describe("logVerbose", () => {
  it("calls fn when verbose is true", () => {
    const fn = vi.fn();
    logVerbose(fn, true);
    expect(fn).toHaveBeenCalledOnce();
  });

  it("does not call fn when verbose is false", () => {
    const fn = vi.fn();
    logVerbose(fn, false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("propagates errors thrown inside fn", () => {
    const fn = () => { throw new Error("boom"); };
    expect(() => logVerbose(fn, true)).toThrow("boom");
  });

  it("does not propagate errors when verbose is false (fn never runs)", () => {
    const fn = () => { throw new Error("should not throw"); };
    expect(() => logVerbose(fn, false)).not.toThrow();
  });
});
