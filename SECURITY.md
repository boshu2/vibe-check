# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.7.x   | :white_check_mark: |
| 1.x.x   | :white_check_mark: |

## Security Assessment

**Last Review:** 2025-12-05
**Risk Level:** LOW
**Reviewer:** Automated + Manual

### Summary

vibe-check is a local CLI tool that reads git history and writes statistics to local files. It has a minimal attack surface:

- No network requests (except GitHub Action for PR comments)
- No sensitive data handling
- No privilege escalation paths
- Trusted, minimal dependencies

---

## Threat Model

### What vibe-check does

1. Reads git commit history via `simple-git`
2. Calculates metrics from commit patterns
3. Writes profile/calibration data to `.vibe-check/` directory
4. Optionally installs a pre-push git hook
5. Detects work sessions from commit timestamps (pure analysis)
6. Analyzes patterns like debug spirals and vague commits (pure analysis)

### What vibe-check does NOT do

- Make network requests
- Handle authentication tokens (except GitHub Action)
- Execute user-provided code
- Access files outside the repository or `~/.vibe-check/`
- Run with elevated privileges

---

## Known Security Considerations

### 1. Shell Command Construction in Git Hook

**Severity:** Low
**Location:** `hooks/pre-push`, `src/commands/init-hook.ts`

The pre-push hook uses `eval` to construct commands:

```bash
OUTPUT=$(eval "$VIBE_CMD $SINCE_FLAG" 2>&1)
```

**Risk:** Theoretical command injection if git commit dates contain shell metacharacters.

**Mitigation:**
- `SINCE_FLAG` is derived from `git log --format=%ci` output
- Git date format is strictly controlled by git itself
- Attacker would need to compromise git internals

**Actual Risk:** Negligible in practice.

### 2. File Path Handling

**Severity:** Low
**Location:** `src/calibration/storage.ts`, `src/gamification/profile.ts`

The `--repo` flag accepts a path that's used for file operations.

**Risk:** Path traversal if malicious path provided.

**Mitigation:**
- User controls the `--repo` flag (self-targeted attack)
- Writes only to `.vibe-check/` subdirectory
- Profile stored in user's home directory, not repo

**Actual Risk:** None - users would only be affecting their own system.

### 3. GitHub Action Input Handling

**Severity:** Low
**Location:** `action.yml`

Action inputs are passed to shell commands.

**Mitigation:**
- GitHub sanitizes workflow inputs
- Only collaborators can trigger PR workflows
- Inputs validated by vibe-check CLI

---

## Dependencies

All dependencies are widely-used, trusted packages:

| Package | Purpose | Risk |
|---------|---------|------|
| simple-git | Git operations | Low - no shell execution |
| commander | CLI framework | Low - argument parsing only |
| chalk | Terminal colors | Low - output formatting only |
| date-fns | Date formatting | Low - pure functions |
| enquirer | CLI prompts | Low - user input handling |

Run `npm audit` to check for known vulnerabilities.

---

## Security Best Practices for Users

### Git Hook

The pre-push hook executes on every `git push`. To review what it does:

```bash
cat .git/hooks/pre-push
```

To disable temporarily:

```bash
git push --no-verify
```

To remove:

```bash
rm .git/hooks/pre-push
```

### Profile Data

Profile data is stored in `~/.vibe-check/profile.json`. This contains:
- Session history (dates, scores, commits analyzed)
- XP and achievement data
- No sensitive information

To clear your profile:

```bash
rm -rf ~/.vibe-check/
```

### Repository Data

Calibration data is stored in `.vibe-check/` within each repository. Add to `.gitignore` if you don't want to commit it:

```bash
echo ".vibe-check/" >> .gitignore
```

---

## Reporting a Vulnerability

If you discover a security vulnerability, please:

1. **Do NOT** open a public issue
2. Email the maintainer directly or use GitHub's private vulnerability reporting
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We aim to respond within 48 hours and will credit reporters in the fix announcement.

---

## Changelog

| Date | Version | Change |
|------|---------|--------|
| 2025-12-05 | 1.7.0 | Added forensics, sessions commands; updated threat model |
| 2025-11-29 | 1.2.0 | Initial security review documented |
