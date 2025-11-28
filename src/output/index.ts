import { VibeCheckResult, OutputFormat } from '../types';
import { formatTerminal } from './terminal';
import { formatJson } from './json';
import { formatMarkdown } from './markdown';

export function formatOutput(result: VibeCheckResult, format: OutputFormat): string {
  switch (format) {
    case 'json':
      return formatJson(result);
    case 'markdown':
      return formatMarkdown(result);
    case 'terminal':
    default:
      return formatTerminal(result);
  }
}

export { formatTerminal } from './terminal';
export { formatJson } from './json';
export { formatMarkdown } from './markdown';
