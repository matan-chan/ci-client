import type { Issue, AnalysisResult, Location } from "./types";
import chalk from "chalk";

export const displayIssues = (issues: Issue[]): void => {
  if (issues.length === 0) return;
  console.log(chalk.bold("\n📋 Issues Found:\n"));
  for (const issue of issues) displayIssue(issue);
};

type DisplayableIssue = Issue | { severity: string; message: string; file?: string; location?: Location; suggestion?: string; relatedLocations?: Location[] };

const displayIssue = (issue: DisplayableIssue): void => {
  const icon = getIssueIcon(issue.severity);
  const color = getIssueColor(issue.severity);
  const label = issue.severity.toUpperCase();
  const file = issue.location?.file ?? (issue as { file?: string }).file ?? "unknown";
  const start = issue.location?.start ?? { line: 0, column: 0 };
  console.log(color(`${icon} [${label}] ${issue.message}`));
  console.log(chalk.gray(`   ${file}:${start.line}:${start.column}`));
  if ("suggestion" in issue && issue.suggestion) console.log(chalk.cyan(`   💡 ${issue.suggestion}`));
  if ("relatedLocations" in issue && issue.relatedLocations && issue.relatedLocations.length > 0) {
    console.log(chalk.gray("   Related locations:"));
    for (const loc of issue.relatedLocations) console.log(chalk.gray(`   - ${loc.file}:${loc.start.line}:${loc.start.column}`));
  }
  console.log();
};

const getIssueIcon = (severity: string): string => {
  switch (severity) {
    case "error":
      return "✗";
    case "warning":
      return "⚠";
    case "info":
      return "ℹ";
    default:
      return "•";
  }
};

const getIssueColor = (severity: string) => {
  switch (severity) {
    case "error":
      return chalk.red;
    case "warning":
      return chalk.yellow;
    case "info":
      return chalk.blue;
    default:
      return chalk.gray;
  }
};

export const displaySummary = (result: AnalysisResult): void => {
  console.log(chalk.bold("\n📊 Summary:"));
  if (result.errorCount > 0) console.log(chalk.red(`  ✗ ${result.errorCount} error${result.errorCount === 1 ? "" : "s"}`));
  if (result.warningCount > 0) console.log(chalk.yellow(`  ⚠ ${result.warningCount} warning${result.warningCount === 1 ? "" : "s"}`));
  if (result.infoCount > 0) console.log(chalk.blue(`  ℹ ${result.infoCount} info`));
  if (result.errorCount === 0 && result.warningCount === 0 && result.infoCount === 0) console.log(chalk.green("  ✓ No issues found"));
  displayScores(result);
};

const displayScores = (result: AnalysisResult): void => {
  console.log(chalk.bold("\n📈 Scores:"));
  const scoreColor = getScoreColor(result.overallScore);
  const scoreBar = generateScoreBar(result.overallScore);
  console.log(scoreColor(`  Overall Score: ${result.overallScore}/${result.maxPossibleScore} ${scoreBar}`));
  console.log(chalk.gray("\n  Category Scores:"));
  const categories = Object.keys(result.categoryScores).sort();
  for (const category of categories) {
    const score = result.categoryScores[category]!;
    const categoryColor = getScoreColor(score);
    const categoryBar = generateScoreBar(score);
    console.log(categoryColor(`    ${category.padEnd(20)} ${String(score).padStart(3)}/${result.maxPossibleScore} ${categoryBar}`));
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  if (score >= 40) return chalk.hex("#FF8800");
  return chalk.red;
};

const generateScoreBar = (score: number, length: number = 20): string => {
  const filled = Math.round((score / 100) * length);
  const empty = length - filled;
  return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
};
