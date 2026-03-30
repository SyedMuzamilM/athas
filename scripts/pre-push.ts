#!/usr/bin/env bun
import { $ } from "bun";

async function ensureCleanWorktree() {
  const status = await $`git status --porcelain`.text();
  if (status.trim().length > 0) {
    console.error("Push blocked: working tree is dirty. Commit or stash changes before pushing.");
    process.exit(1);
  }
}

await ensureCleanWorktree();
await $`bash scripts/check-all.sh`.cwd(process.cwd());
