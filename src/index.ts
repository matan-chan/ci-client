import { Command } from "commander";
import { handleCiClientCommand } from "./cli/command";
import { handleCiError } from "./handlers/errorHandlers";

const program = new Command();

program
  .name("nginx-analyze-ci")
  .description("CI client: discover nginx configs and send to analysis server")
  .version("0.1.0");

program
  .argument("[directory]", "Directory to search for nginx configs", ".")
  .option("-s, --strict", "Fail on warnings")
  .option("-v, --verbose", "Verbose output")
  .option("--format <format>", "Output format (json|text)", "text")
  .option("--pattern <pattern>", "Custom search pattern for nginx files")
  .option("--key <key>", "API key (or NGINX_ANALYZE_TOKEN)")
  .option("--environment <env>", "Environment name e.g. production, dev, pre (or NGINX_ANALYZE_ENVIRONMENT)")
  .option("--allow-quota-exceeded", "Pass with warning when usage limit exceeded (402) instead of failing")
  .action(async (directory: string, options: Record<string, unknown>) => {
    try {
      await handleCiClientCommand(directory, options);
    } catch (error) {
      handleCiError(error);
    }
  });

program.parse();
