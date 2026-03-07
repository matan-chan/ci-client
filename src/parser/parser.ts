import type { ASTNode, Block, Comment, Config, Directive, Location } from "./ast";
import type { Token } from "./lexer";

export class Parser {
  private tokens: Token[];
  private current = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter((t) => t.type !== "NEWLINE");
  }

  parse(): Config {
    const children: ASTNode[] = [];
    while (!this.isAtEnd()) {
      const node = this.parseStatement();
      if (node) children.push(node);
    }
    return { type: "config", children };
  }

  private parseStatement(): ASTNode | null {
    if (this.check("COMMENT")) return this.parseComment();
    if (this.check("WORD")) return this.parseDirectiveOrBlock();
    this.advance();
    return null;
  }

  private parseComment(): Comment {
    const token = this.advance();
    return { type: "comment", text: token.value, location: this.makeLocation(token, token) };
  }

  private parseDirectiveOrBlock(): Directive | Block {
    const nameToken = this.advance();
    const name = nameToken.value;
    const args: string[] = [];
    while (!this.isAtEnd() && !this.check("LBRACE") && !this.check("SEMICOLON")) {
      if (this.check("WORD") || this.check("STRING")) args.push(this.advance().value);
      else break;
    }
    if (this.check("LBRACE")) return this.parseBlock(nameToken, name, args);
    if (this.check("SEMICOLON")) {
      const endToken = this.advance();
      return { type: "directive", name, args, location: this.makeLocation(nameToken, endToken) };
    }
    return { type: "directive", name, args, location: this.makeLocation(nameToken, this.previous()) };
  }

  private parseBlock(startToken: Token, name: string, args: string[]): Block {
    this.consume("LBRACE");
    const children: ASTNode[] = [];
    while (!this.isAtEnd() && !this.check("RBRACE")) {
      const node = this.parseStatement();
      if (node) children.push(node);
    }
    const endToken = this.consume("RBRACE");
    return { type: "block", name, args, children, location: this.makeLocation(startToken, endToken) };
  }

  private check(type: Token["type"]): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    return this.tokens[this.current] ?? this.tokens[this.tokens.length - 1]!;
  }

  private previous(): Token {
    return this.tokens[this.current - 1]!;
  }

  private consume(type: Token["type"]): Token {
    if (this.check(type)) return this.advance();
    const token = this.peek();
    throw new Error(`Expected ${type} but got ${token.type} at line ${token.line}, column ${token.column}`);
  }

  private makeLocation(start: Token, end: Token): Location {
    return { start: { line: start.line, column: start.column }, end: { line: end.line, column: end.column } };
  }
}
