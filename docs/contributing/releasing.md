# Workflow and releasing

This repo keeps the day-to-day flow simple:

- Branch from `master`
- Do the work on a short-lived branch
- Open a PR back into `master`
- Merge into `master`
- Cut preview releases from the version on `master`
- Cut the stable release from `master` after the release candidate is validated

## Branch naming

Use a short branch name with one of these prefixes:

- `feat/<name>` for new features
- `fix/<name>` for bug fixes
- `refactor/<name>` for non-behavioral cleanup
- `docs/<name>` for documentation changes
- `chore/<name>` for maintenance work
- `release/<name>` for release-prep changes

Examples:

- `feat/git-gutter-indicator`
- `fix/windows-build-errors`
- `refactor/file-tree-state`
- `release/0.5.0-rc.1`

## Issues, labels, and triage

Use the issue forms instead of opening free-form issues.

- Bug reports should include reproduction steps, expected behavior, actual behavior, platform, and version
- Feature requests should focus on the problem first, then the proposal
- Enhancements should name the existing area being improved
- Docs issues should point to the exact page or topic that is wrong or missing

Keep labels lightweight:

- Use issue type from the form first
- Add area labels only when they help routing, such as Editor, Git, AI, Terminal, Extensions, or Release
- Add platform labels only when the problem is platform-specific, such as macOS, Windows, or Linux
- Do not block work on perfect labeling

PR labels are optional. Keep the PR itself readable instead of turning labels into a process gate.

## Normal development flow

### Adding a feature

1. Branch from `master`.
2. Use a `feat/...` branch name.
3. Build the feature in small, reviewable commits.
4. Run the checks that match the change:
   - `bun check`
   - `bun test`
   - `bun check:rust` if you touched Rust code
5. Open a PR into `master`.
6. Keep the PR description short:
   - what changed
   - why
   - validation
7. Merge into `master` when it is ready.

### Fixing a bug

1. Confirm the bug on the latest branch or latest release.
2. Branch from `master`.
3. Use a `fix/...` branch name.
4. Add a regression test when practical.
5. Run the relevant checks.
6. Open a PR into `master`.
7. Merge into `master`.

If the bug affects a released version and you want outside confirmation before a stable patch, publish a prerelease build first.

## Choosing a release channel

### Alpha

Use `alpha` when the build is still early, risky, or incomplete.

Good uses:

- Large refactors
- New infrastructure
- Broad AI or editor changes with unknown edge cases
- Work that only a few testers need to try first

### Beta

Use `beta` when the planned work is mostly done and you want broader testing.

Good uses:

- The feature set is in place
- You want feedback from more users
- You expect fixes, but not major scope changes

### RC

Use `rc` when you believe the build should become the stable release unless a blocker appears.

Good uses:

- Final cross-platform validation
- Final packaging checks
- Final updater/install verification

### Stable

Cut the normal release after the `rc` build has been validated and no blocker remains.

## Release commands

Always start with a dry run:

```bash
bun scripts/release.ts <channel> --dry-run
```

Common commands:

```bash
bun scripts/release.ts alpha
bun scripts/release.ts beta
bun scripts/release.ts rc
bun scripts/release.ts patch
bun scripts/release.ts minor
bun scripts/release.ts major
```

You can also target an exact version:

```bash
bun scripts/release.ts 0.5.0-rc.1 --dry-run
bun scripts/release.ts 0.5.0
```

## What the release script does

The release script:

1. Runs `bun release:check` unless skipped explicitly
2. Verifies the git working tree is clean
3. Updates:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   - `Cargo.lock`
4. Creates a release commit
5. Creates tag `v<version>`
6. Pushes `master`
7. Pushes the tag
8. Triggers the GitHub release workflow

GitHub Actions publishes releases from tags matching `v*`.

Examples:

- `v0.5.0-alpha.1`
- `v0.5.0-beta.1`
- `v0.5.0-rc.1`
- `v0.5.0`

## Recommended release flow

### Preview release

Use this when you want test builds before shipping:

1. Merge the changes into `master`.
2. Run `bun scripts/release.ts alpha --dry-run` or the matching channel dry run.
3. Run the real release command.
4. Share the GitHub prerelease with testers.
5. Collect bugs and fix them on `fix/...` branches targeting `master`.
6. Repeat with another alpha, beta, or rc if needed.

### Stable release

Use this after the release candidate is clean:

1. Confirm the latest `rc` build passed validation.
2. Run `bun scripts/release.ts patch --dry-run` or the exact stable version dry run.
3. Run the real release command.
4. Verify the GitHub release assets and updater metadata.

## Platform validation

At minimum, validate on the platforms touched by the change.

### Local validation

- Run `bun dev` on your machine
- Run the normal checks for the code you changed
- If you changed packaging or updater logic, do a dry run first

### Cross-platform validation

For important features, packaging changes, updater changes, shell integration, filesystem behavior, or windowing changes:

- Test on macOS if the change touches macOS behavior
- Test on Windows if the change touches Windows behavior
- Test on Linux if the change touches Linux behavior

If you do not have all platforms locally, use some combination of:

- Maintainer machines
- VMs
- CI artifacts
- External testers through alpha, beta, or rc releases

Do not assume a stable release is ready just because it works on one platform.

## Practical guidance

### I added a feature. What now?

1. Put it on a `feat/...` branch from `master`
2. Run checks
3. Open a PR into `master`
4. Merge it
5. If it is risky or needs real-world feedback, ship `alpha` or `beta`
6. Move to `rc` when you think it is ready
7. Ship stable after validation

### I found a bug. What now?

1. Reproduce it
2. Fix it on a `fix/...` branch from `master`
3. Add a regression test if practical
4. Open a PR into `master`
5. Merge it
6. If confidence is low or platform behavior is involved, ship `alpha`, `beta`, or `rc` first
7. Ship a stable patch once the fix is validated

### I only changed docs or small polish. Do I need a prerelease?

Usually no. Merge to `master` and include it in the next normal release unless the change affects packaging, onboarding, updater behavior, or something risky.
