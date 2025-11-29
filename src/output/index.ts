import { VibeCheckResult, VibeCheckResultV2, OutputFormat } from '../types';
import { formatTerminal, formatTerminalSimple } from './terminal';
import { formatJson } from './json';
import { formatMarkdown } from './markdown';

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

export { formatTerminal, formatTerminalSimple } from './terminal';
export { formatJson } from './json';
export { formatMarkdown } from './markdown';
