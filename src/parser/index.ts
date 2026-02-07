import { tokenize } from "./lexer";
import { Parser } from "./parser";
import type { Config } from "./ast";

export const parseNginxConfig = (input: string): Config => {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  return parser.parse();
};

export * from "./ast";
export * from "./lexer";
export { Parser } from "./parser";
