# vibe-check Enhancement Proposal

**Package:** @boshu2/vibe-check v1.7.0
**Purpose:** Add git forensics capabilities proven in release-engineering retrospective
**Date:** December 5, 2025

---

## Summary

Three proven algorithms from the release-engineering retrospective (475 commits, 60 days) should be integrated into vibe-check as new features:

1. **Git Forensics** - Repository analysis with pattern detection
2. **Session Detection** - Work session identification (90-min threshold)
3. **Era Evolution** - Track transformation phases over time

**Impact:** Transform vibe-check from real-time monitor → comprehensive retrospective tool

---

## Enhancement #1: Git Forensics Mode

### Command
```bash
npx @boshu2/vibe-check forensics [--since DATE] [--format json|markdown]
```

### What It Does
Analyzes git history to detect failure patterns and calculate quality metrics.

### Outputs
```json
{
  "analysis_period": "2025-10-04 to 2025-12-05",
  "total_commits": 475,
  "patterns_detected": {
    "debug_spirals": {
      "count": 14,
      "duration_minutes": 58.7,
      "dates": ["2025-10-04"],
      "commits": ["7b07068", "bb685a2", ...]
    },
    "vague_commits": {
      "count": 282,
      "percentage": 59.4,
      "threshold": 20,
      "examples": ["ci", "v3", "blah", "take 2"]
    },
    "context_amnesia": {
      "scopes": [
        {"name": "ci", "visits": 10},
        {"name": "automation", "visits": 9},
        {"name": "pipelines", "visits": 8}
      ]
    }
  },
  "quality_metrics": {
    "conventional_commits": 28.6,
    "descriptive_quality": 30.7,
    "vague_quality": 59.4
  },
  "recommendation": "sweep",
  "sweep_targets": ["lib/common.sh", "harmonize.sh", "scaffold.sh"]
}
```

### Implementation Algorithm

```python
# Pseudocode from release-engineering analysis
def git_forensics(since_date):
    # Extract commits
    commits = git_log(format="%H|%h|%an|%ae|%ai|%at|%s", since=since_date)

    # Parse each commit
    parsed = []
    for commit in commits:
        hash, short, author, email, date_iso, timestamp, subject = commit.split('|')

        # Detect patterns
        is_take = re.match(r'^take [0-9]+$', subject)
        is_vague = len(subject) < 20
        is_conventional = re.match(r'^(feat|fix|docs|test|refactor|chore)', subject)

        parsed.append({
            'hash': short,
            'subject': subject,
            'is_take': is_take,
            'is_vague': is_vague,
            'is_conventional': is_conventional,
            'timestamp': int(timestamp)
        })

    # Detect debug spirals
    take_commits = [c for c in parsed if c['is_take']]
    if len(take_commits) >= 3:
        first = min(take_commits, key=lambda c: c['timestamp'])
        last = max(take_commits, key=lambda c: c['timestamp'])
        duration_min = (last['timestamp'] - first['timestamp']) / 60

        patterns['debug_spirals'] = {
            'count': len(take_commits),
            'duration_minutes': duration_min
        }

    # Calculate quality metrics
    total = len(parsed)
    vague_count = len([c for c in parsed if c['is_vague']])
    conventional_count = len([c for c in parsed if c['is_conventional']])

    quality_metrics = {
        'conventional_commits': 100 * conventional_count / total,
        'vague_quality': 100 * vague_count / total
    }

    # Recommendation
    if vague_count > total * 0.5 or len(take_commits) > 0:
        recommendation = 'sweep'

    return {
        'patterns_detected': patterns,
        'quality_metrics': quality_metrics,
        'recommendation': recommendation
    }
```

### Files to Create
- `src/commands/forensics.js` - Main command
- `src/analyzers/patterns.js` - Pattern detection
- `src/analyzers/quality.js` - Quality metrics

---

## Enhancement #2: Session Detection

### Command
```bash
npx @boshu2/vibe-check sessions [--threshold MINUTES] [--format json]
```

### What It Does
Identifies work sessions from git history using configurable time gap threshold.

### Output
```json
{
  "total_sessions": 46,
  "total_commits": 475,
  "avg_commits_per_session": 10.3,
  "avg_duration_minutes": 79.4,
  "median_duration_minutes": 33.1,
  "longest_session_minutes": 413.2,
  "sessions": [
    {
      "session_id": 1,
      "start_date": "2025-10-04 11:59:47",
      "end_date": "2025-10-04 16:53:29",
      "duration_minutes": 293.7,
      "num_commits": 50,
      "commits": ["c83fea9", "de59b1c", ...]
    }
  ]
}
```

### Implementation Algorithm

```python
# Proven algorithm from release-engineering
def detect_sessions(commits, gap_threshold=90):
    """
    Detect work sessions using time gap between commits.

    Args:
        commits: List of commits sorted by timestamp
        gap_threshold: Minutes between commits to start new session (default: 90)

    Returns:
        List of sessions with metadata
    """
    SESSION_GAP = gap_threshold * 60  # Convert to seconds
    sessions = []
    current_session = []

    for commit in sorted(commits, key=lambda c: c['timestamp']):
        if not current_session:
            current_session = [commit]
        elif commit['timestamp'] - current_session[-1]['timestamp'] > SESSION_GAP:
            # Gap exceeded, save current session and start new
            sessions.append({
                'start': current_session[0],
                'end': current_session[-1],
                'commits': current_session,
                'duration_min': (current_session[-1]['timestamp'] - current_session[0]['timestamp']) / 60
            })
            current_session = [commit]
        else:
            current_session.append(commit)

    # Don't forget last session
    if current_session:
        sessions.append({
            'start': current_session[0],
            'end': current_session[-1],
            'commits': current_session,
            'duration_min': (current_session[-1]['timestamp'] - current_session[0]['timestamp']) / 60
        })

    return sessions
```

### Use Cases
- Productivity analysis (session duration trends)
- Work pattern identification (when do you work best?)
- Break analysis (gap between sessions)
- Integration with time tracking tools

### Files to Create
- `src/commands/sessions.js` - Main command
- `src/analyzers/sessions.js` - Session detection algorithm

---

## Enhancement #3: Era Evolution Tracking

### Command
```bash
npx @boshu2/vibe-check evolution [--eras CONFIG] [--format json]
```

### What It Does
Classifies commits into user-defined eras and tracks quality evolution over time.

### Configuration
```json
{
  "eras": [
    {
      "name": "genesis",
      "start": "2025-10-04",
      "end": "2025-10-05",
      "description": "Initial chaos"
    },
    {
      "name": "transformation",
      "start": "2025-11-18",
      "end": "2025-12-02",
      "description": "Post-sweep discipline"
    }
  ]
}
```

### Output
```json
{
  "eras": [
    {
      "name": "genesis",
      "commits": 154,
      "sessions": 6,
      "metrics": {
        "conventional": 0.0,
        "vague": 97.4,
        "velocity": 10.79,
        "rework_ratio": 6.5,
        "debug_spirals": 14
      }
    },
    {
      "name": "transformation",
      "commits": 63,
      "sessions": 10,
      "metrics": {
        "conventional": 85.7,
        "vague": 0.0,
        "velocity": 6.97,
        "rework_ratio": 25.4,
        "debug_spirals": 0
      }
    }
  ],
  "transformation_summary": {
    "conventional": "+85.7%",
    "vague": "-97.4%",
    "debug_spirals": "-14"
  }
}
```

### Implementation Algorithm

```python
# Era classification from release-engineering
def classify_eras(commits, era_config):
    """
    Classify commits into eras and calculate per-era metrics.

    Args:
        commits: List of parsed commits
        era_config: Era definitions with start/end dates

    Returns:
        Metrics grouped by era
    """
    commits_by_era = defaultdict(list)

    for commit in commits:
        commit_date = commit['date_iso'].split()[0]

        # Find matching era
        for era in era_config:
            if era['start'] <= commit_date <= era['end']:
                commits_by_era[era['name']].append(commit)
                break

    # Calculate metrics per era
    results = []
    for era_name, era_commits in commits_by_era.items():
        total = len(era_commits)

        metrics = {
            'conventional': 100 * sum(1 for c in era_commits if c['is_conventional']) / total,
            'vague': 100 * sum(1 for c in era_commits if c['is_vague']) / total,
            'debug_spirals': sum(1 for c in era_commits if c['is_take'])
        }

        results.append({
            'name': era_name,
            'commits': total,
            'metrics': metrics
        })

    return results
```

### Use Cases
- Transformation stories (before/after)
- Quarterly reviews (Q1, Q2, Q3, Q4)
- Migration tracking (pre-refactor, during, post)
- Team onboarding impact (before new dev, after)

### Files to Create
- `src/commands/evolution.js` - Main command
- `src/analyzers/eras.js` - Era classification
- `src/config/eras.schema.json` - Era config validation

---

## Integration Points

### Current vibe-check Commands
```bash
vibe-check analyze       # Real-time metrics for current session
vibe-check history       # Historical trend analysis
```

### New Commands (Proposed)
```bash
vibe-check forensics     # Git history pattern detection
vibe-check sessions      # Work session analysis
vibe-check evolution     # Era-based transformation tracking
vibe-check sweep-check   # Quick check: is sweep needed?
```

### sweep-check Integration
```bash
npx @boshu2/vibe-check sweep-check

# Combines forensics + pattern detection + recommendation
# Output:
⚠️ Sweep recommended
Detected patterns:
  - 12 vague commits (threshold: >5)
  - 2 debug spirals
  - Context amnesia: ci (10 visits), automation (9 visits)

Targets for sweep:
  - lib/common.sh (0% test coverage, 8 vague commits)
  - harmonize.sh (no tests, spiral detected)

Run: npx @boshu2/vibe-check sweep --target lib/common.sh
```

---

## Implementation Priority

### Phase 1: Core Forensics (MVP)
- [ ] Git log parsing
- [ ] Pattern detection (vague commits, debug spirals)
- [ ] Basic quality metrics
- [ ] JSON output
- **Estimate:** 2-3 days

### Phase 2: Sessions & Evolution
- [ ] Session detection algorithm
- [ ] Era classification
- [ ] Comparative metrics
- [ ] Markdown/Terminal output
- **Estimate:** 2-3 days

### Phase 3: Integration
- [ ] sweep-check convenience command
- [ ] Integration with existing analyze command
- [ ] Historical storage
- [ ] Dashboard visualization
- **Estimate:** 2-3 days

---

## Testing Strategy

### Unit Tests
```javascript
describe('forensics', () => {
  it('detects debug spirals from take N pattern', () => {
    const commits = [
      { subject: 'take 2', timestamp: 1000 },
      { subject: 'take 3', timestamp: 1300 },
      { subject: 'take 4', timestamp: 1600 }
    ];
    const patterns = detectPatterns(commits);
    expect(patterns.debug_spirals.count).toBe(3);
    expect(patterns.debug_spirals.duration_minutes).toBe(10);
  });

  it('detects vague commits', () => {
    const commits = [
      { subject: 'ci' },
      { subject: 'v3' },
      { subject: 'feat: proper commit message' }
    ];
    const quality = calculateQuality(commits);
    expect(quality.vague_percentage).toBe(66.7);
  });
});
```

### Integration Tests
- Test against real repositories (release-engineering as reference)
- Validate against known metrics (475 commits → 46 sessions)
- Compare with manual analysis

---

## Reference Implementation

All algorithms proven in:
- **Repository:** release-engineering (475 commits analyzed)
- **Files:** `/tmp/full_parse.py`, `/tmp/detect_sessions.py`, `/tmp/calc_vibe_metrics.py`
- **Story:** `THE-RELEASE-ENGINEERING-STORY.md`

**Results:**
- Successfully detected 14 debug spirals
- Calculated metrics across 5 eras
- Identified 46 work sessions
- Proved transformation: 97.4% vague → 0%

---

## Benefits

**For Individual Developers:**
- Understand your coding patterns
- Identify when you're most productive
- Catch failure patterns before they compound

**For Teams:**
- Track transformation progress
- Identify training needs
- Celebrate improvements with data

**For Organizations:**
- Prove ROI of process improvements
- Benchmark across projects
- Make data-driven decisions

---

## Next Steps

1. **Validate approach** with vibe-check maintainers
2. **Create GitHub issue** with this proposal
3. **Implement Phase 1** (forensics MVP)
4. **Get community feedback** on UX
5. **Iterate** based on real-world usage

---

**Contact:** Boden Fuller (boden.fuller@gdit.com)
**Reference:** release-engineering retrospective (Dec 5, 2025)
**Tags:** `#vibe-check` `#git-forensics` `#enhancement-proposal`
