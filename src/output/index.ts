import { VibeCheckResult, VibeCheckResultV2, OutputFormat } from '../types.js';
import { formatTerminal, formatTerminalSimple } from './terminal.js';
import { formatJson } from './json.js';
import { formatMarkdown } from './markdown.js';

export interface OutputOptions {
  simple?: boolean;
}

export function formatOutput(
  result: VibeCheckResult | VibeCheckResultV2,
  format: OutputFormat,
  options: OutputOptions = {}
): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'markdown':
      return formatMarkdown(result);
    case 'terminal':
    default:
      return options.simple ? formatTerminalSimple(result) : formatTerminal(result);
  }
}

export { formatTerminal, formatTerminalSimple } from './terminal.js';
export { formatJson } from './json.js';
export { formatMarkdown } from './markdown.js';
