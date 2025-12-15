import { differenceInMinutes } from 'date-fns';
import { Commit, FixChain, MetricResult, Rating } from '../types.js';

const SPIRAL_THRESHOLD = 3; // 3+ consecutive fixes = spiral

// Pattern detection regexes
const PATTERNS: Record<string, RegExp> = {
  VOLUME_CONFIG: /volume|mount|path|permission|readonly|pvc|storage/i,
  SECRETS_AUTH: /secret|auth|oauth|token|credential|password|key/i,
  API_MISMATCH: /api|version|field|spec|schema|crd|resource/i,
  SSL_TLS: /ssl|tls|cert|fips|handshake|https/i,
  IMAGE_REGISTRY: /image|pull|registry|docker|tag/i,
  GITOPS_DRIFT: /drift|sync|argocd|reconcil|outof/i,
};

export function detectFixChains(commits: Commit[]): FixChain[] {
  if (commits.length === 0) return [];

  // Sort by date ascending
  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());

  const chains: FixChain[] = [];
  let currentChain: Commit[] = [];
  let currentComponent: string | null = null;

  for (const commit of sorted) {
    if (commit.type === 'fix') {
      const component = getComponent(commit);

      if (component === currentComponent || currentComponent === null) {
        currentChain.push(commit);
        currentComponent = component;
      } else {
        // Different component, save current chain if valid
        if (currentChain.length >= SPIRAL_THRESHOLD) {
          chains.push(createFixChain(currentChain, currentComponent));
        }
        currentChain = [commit];
        currentComponent = component;
      }
    } else {
      // Non-fix commit breaks the chain
      if (currentChain.length >= SPIRAL_THRESHOLD && currentComponent) {
        chains.push(createFixChain(currentChain, currentComponent));
      }
      currentChain = [];
      currentComponent = null;
    }
  }

  // Handle final chain
  if (currentChain.length >= SPIRAL_THRESHOLD && currentComponent) {
    chains.push(createFixChain(currentChain, currentComponent));
  }

  return chains;
}

function getComponent(commit: Commit): string {
  // Use scope if available
  if (commit.scope) {
    return commit.scope.toLowerCase();
  }

  // Extract first meaningful word from message
  const words = commit.message
    .replace(/^fix\s*:?\s*/i, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return words[0]?.toLowerCase() || 'unknown';
}

function createFixChain(commits: Commit[], component: string): FixChain {
  const firstCommit = commits[0].date;
  const lastCommit = commits[commits.length - 1].date;
  const duration = differenceInMinutes(lastCommit, firstCommit);

  // Detect pattern from commit messages
  const allMessages = commits.map((c) => c.message).join(' ');
  const pattern = detectPattern(allMessages);

  return {
    component,
    commits: commits.length,
    duration,
    isSpiral: commits.length >= SPIRAL_THRESHOLD,
    pattern,
    firstCommit,
    lastCommit,
  };
}

function detectPattern(text: string): string | null {
  for (const [pattern, regex] of Object.entries(PATTERNS)) {
    if (regex.test(text)) {
      return pattern;
    }
  }
  return null;
}

export function calculateDebugSpiralDuration(chains: FixChain[]): MetricResult {
  const spirals = chains.filter((c) => c.isSpiral);

  if (spirals.length === 0) {
    return {
      value: 0,
      unit: 'min',
      rating: 'elite',
      description: 'No debug spirals detected',
    };
  }

  const totalDuration = spirals.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = totalDuration / spirals.length;
  const rating = getRating(avgDuration);

  return {
    value: Math.round(avgDuration),
    unit: 'min',
    rating,
    description: getDescription(rating, spirals.length),
  };
}

function getRating(duration: number): Rating {
  if (duration < 15) return 'elite';
  if (duration < 30) return 'high';
  if (duration < 60) return 'medium';
  return 'low';
}

function getDescription(rating: Rating, spiralCount: number): string {
  const spiralText = spiralCount === 1 ? '1 spiral' : `${spiralCount} spirals`;

  switch (rating) {
    case 'elite':
      return `${spiralText} resolved quickly`;
    case 'high':
      return `${spiralText}, normal debugging time`;
    case 'medium':
      return `${spiralText}, consider using tracer tests`;
    case 'low':
      return `${spiralText}, extended debugging. Use tracer tests before implementation`;
  }
}

export function calculatePatternSummary(chains: FixChain[]): {
  categories: Record<string, number>;
  total: number;
  tracerAvailable: number;
} {
  const categories: Record<string, number> = {};
  let total = 0;
  let withTracer = 0;

  for (const chain of chains) {
    const pattern = chain.pattern || 'OTHER';
    categories[pattern] = (categories[pattern] || 0) + chain.commits;
    total += chain.commits;

    if (chain.pattern) {
      withTracer += chain.commits;
    }
  }

  return {
    categories,
    total,
    tracerAvailable: total > 0 ? Math.round((withTracer / total) * 100) : 0,
  };
}
