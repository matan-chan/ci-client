export type TokenType = "WORD" | "STRING" | "LBRACE" | "RBRACE" | "SEMICOLON" | "COMMENT" | "NEWLINE" | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export const tokenize = (input: string): Token[] => {
  const tokens: Token[] = [];
  let line = 1;
  let column = 1;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (char === "\n") {
      tokens.push({ type: "NEWLINE", value: "\n", line, column });
      line++;
      column = 1;
      i++;
      continue;
    }

    if (char === " " || char === "\t" || char === "\r") {
      column++;
      i++;
      continue;
    }

    if (char === "#") {
      const start = i;
      const startCol = column;
      i++;
      column++;
      while (i < input.length && input[i] !== "\n") {
        i++;
        column++;
      }
      const comment = input.slice(start + 1, i).trim();
      tokens.push({ type: "COMMENT", value: comment, line, column: startCol });
      continue;
    }

    if (char === "{") {
      tokens.push({ type: "LBRACE", value: "{", line, column });
      column++;
      i++;
      continue;
    }

    if (char === "}") {
      tokens.push({ type: "RBRACE", value: "}", line, column });
      column++;
      i++;
      continue;
    }

    if (char === ";") {
      tokens.push({ type: "SEMICOLON", value: ";", line, column });
      column++;
      i++;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const start = i;
      const startCol = column;
      i++;
      column++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          i += 2;
          column += 2;
        } else {
          i++;
          column++;
        }
      }
      if (i < input.length) {
        i++;
        column++;
      }
      const str = input.slice(start + 1, i - 1);
      tokens.push({ type: "STRING", value: str, line, column: startCol });
      continue;
    }

    if (/[^\s{};"'#]/.test(char ?? "")) {
      const start = i;
      const startCol = column;
      while (i < input.length && /[^\s{};"'#]/.test(input[i] ?? "")) {
        i++;
        column++;
      }
      const word = input.slice(start, i);
      tokens.push({ type: "WORD", value: word, line, column: startCol });
      continue;
    }

    i++;
    column++;
  }

  tokens.push({ type: "EOF", value: "", line, column });
  return tokens;
};
