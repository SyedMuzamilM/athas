## Project Overview

- Athas is a desktop code editor built with Tauri, React, TypeScript, and Rust.
- Frontend feature code lives under `src/features/`.
- Shared frontend code lives under `src/components`, `src/hooks`, and `src/utils`.
- Extension-specific code lives under `src/extensions/`.
- Rust feature logic should prefer `crates/[feature]`; keep `src-tauri` focused on app wiring and integration.

## Setup And Validation

- Always use Bun for repo scripts and package management.
- Required environment: Bun `1.3.2`, Node.js `22+`, and Rust.
- Install dependencies with `bun install`.
- Start the app with `bun dev`.
- Run full checks with `bun check`.
- Run tests with `bun test`.
- Run TypeScript checks with `bun typecheck`.
- Run Rust checks with `bun check:rust` when touching Rust code.
- When touching release flow, validate locally with `bun scripts/release.ts <channel> --dry-run` before anything else, then run `bun release:check`.

## Workflow Rules

- Never change `AGENTS.md` unless the user explicitly asks.
- Do not prefix unused variables with an underscore; delete them instead.
- Do not use emojis in commit messages, logs, or documentation.
- Validate the relevant checks after making changes instead of stopping at code edits.

## Branches And Releases

- Branch from `master`.
- Use short-lived branches with clear prefixes such as `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`, and `release/`.
- Open normal pull requests into `master`.
- Keep release tags and stable releases on `master`.
- Use prerelease versions to ship preview builds before a stable release instead of tagging ad hoc debug builds.
- Use `alpha` for early or high-risk work that needs limited testing.
- Use `beta` for feature-complete work that needs broader validation.
- Use `rc` for builds that are expected to ship unless a blocker is found.
- Cut a stable release only after the relevant `rc` build has been validated on the platforms affected by the change.

## Commits And PRs

- Keep commits focused. One logical change per commit.
- Commit messages should be short, direct, and imperative.
- Start commit messages with an uppercase letter.
- Add a short commit body when the change benefits from extra context.
- Prefer a single 1-3 sentence commit body.
- Wrap long lines if needed, but keep the body as one paragraph unless extra structure is necessary.
- Commit bodies should explain what changed and why in plain language, without headings or boilerplate.
- Avoid prefixes, filler, hype, and changelog-style noise in commit messages.
- Before creating a commit, run the checks that match the change.
- Before opening a PR, run the relevant validation again for the final diff.
- PR titles should be short and plain.
- PR descriptions should be plain natural language with a few short bullet points, no headers, and no section templates.
- PR descriptions should explain what changed and why, without restating the file list.
- When release, packaging, or versioning is involved, include the validation you ran in the PR description.

## Code Style

- Follow existing code style and keep changes aligned with nearby code.
- Avoid unnecessary comments in UI components; prefer self-explanatory code.
- Avoid unnecessary `cn(...)` calls; use it only for conditional or merged class names.
- Use Tailwind utilities for normal component styling.
- Use CSS variables for theme colors; do not hardcode hex values in UI code.
- Interactive elements must remain accessible, including accessible names for icon-only controls and usable keyboard/focus behavior.

## Zustand

- Always use the `createSelectors` wrapper for stores.
- Prefer `store.use.property()` selectors over inline state selectors when available.
- Group store actions inside an `actions` object.
- Use `getState()` to access other stores inside actions instead of passing dependent state through parameters.
- Use `immer` when store updates are deeply nested.
- Use `persist` for state that must sync to local storage.
- Use `createWithEqualityFn` or `useShallow` when selector stability matters and rerenders would otherwise be noisy.

## Code Organization

- Group feature-specific code under `src/features/[feature]/`.
- Prefer subfolders such as `components`, `hooks`, `services`, `stores`, `types`, `utils`, and `tests` instead of leaving feature logic in the feature root.
- Do not put feature-specific code in global shared folders unless it is genuinely shared across features.
- Keep feature tests under `src/features/[feature]/tests/` when practical.
- New user-facing documentation belongs in the `www` repo under `www/docs/`, not in this repo.

## Release Rules

- Validate release changes locally before publishing anything.
- Do not use real release tags to debug release automation.
- Keep Windows MSI versioning numeric-only via `tauri.bundle.windows.wix.version`; do not use prerelease app versions directly for MSI builds.
- Release automation is triggered by pushing `v*` tags.
- Use `bun scripts/release.ts <channel> --dry-run` before running a real release command.
