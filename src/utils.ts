export const logVerbose = (fn: () => void, verbose: boolean): void => {
  if (verbose) fn();
};
