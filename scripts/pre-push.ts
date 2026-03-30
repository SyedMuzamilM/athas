#!/usr/bin/env bun
import { $ } from "bun";

await $`bash scripts/check-all.sh`.cwd(process.cwd());
