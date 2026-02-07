export interface Position {
  line: number;
  column: number;
}

export interface Location {
  start: Position;
  end: Position;
}

export type ASTNode = Directive | Block | Comment;

export interface Directive {
  type: "directive";
  name: string;
  args: string[];
  location: Location;
}

export interface Block {
  type: "block";
  name: string;
  args: string[];
  children: ASTNode[];
  location: Location;
}

export interface Comment {
  type: "comment";
  text: string;
  location: Location;
}

export interface Config {
  type: "config";
  children: ASTNode[];
}
