export type Severity = "error" | "warning" | "info";

export interface Position {
  line: number;
  column: number;
}

export interface Location {
  file: string;
  start: Position;
  end?: Position;
}

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  location: Location;
  suggestion?: string;
  relatedLocations?: Location[];
}

export interface AnalysisResult {
  issues: Issue[];
  warningCount: number;
  errorCount: number;
  infoCount: number;
  overallScore: number;
  categoryScores: Record<string, number>;
  maxPossibleScore: number;
}
