#!/usr/bin/env bun
import { $ } from "bun";

async function getStagedFiles(): Promise<string[]> {
  const output = await $`git diff --cached --name-only --diff-filter=ACMR`.text();
  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

async function getUntrackedFiles(): Promise<string[]> {
  const output = await $`git ls-files --others --exclude-standard`.text();
  return output
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
}

function isUntrackedSourceFile(file: string): boolean {
  const sourceRoots = ["src/", "src-tauri/", "crates/", "scripts/"];
  const sourceExtensions = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".rs", ".toml"];

  return (
    sourceRoots.some((root) => file.startsWith(root)) &&
    sourceExtensions.some((extension) => file.endsWith(extension))
  );
}

async function main() {
  const stagedFiles = await getStagedFiles();
  const untrackedSourceFiles = (await getUntrackedFiles()).filter(isUntrackedSourceFile);

  if (untrackedSourceFiles.length > 0) {
    console.error("Untracked source files detected. Stage or remove them before committing:");
    for (const file of untrackedSourceFiles) {
      console.error(`  - ${file}`);
    }
    process.exit(1);
  }

  if (stagedFiles.length === 0) {
    console.log("No staged files to validate.");
    return;
  }

  const rustFiles = stagedFiles.filter(
    (file) => file.endsWith(".rs") || file.endsWith("Cargo.toml") || file.endsWith("Cargo.lock"),
  );
  const frontendFiles = stagedFiles.filter(
    (file) =>
      !file.endsWith(".rs") &&
      !file.endsWith("Cargo.toml") &&
      !file.endsWith("Cargo.lock") &&
      !file.startsWith("src-tauri/target/") &&
      !file.startsWith("public/tree-sitter/parsers/"),
  );

  if (frontendFiles.length > 0) {
    console.log(`Running vp check --fix on ${frontendFiles.length} staged file(s)...`);
    await $`bunx vp check --fix ${frontendFiles}`.cwd(process.cwd());
  }

  if (rustFiles.length > 0) {
    console.log("Running cargo fmt --all for staged Rust changes...");
    await $`cargo fmt --all`.cwd(process.cwd());
  }

  if (frontendFiles.length > 0 || rustFiles.length > 0) {
    await $`git update-index --again`.cwd(process.cwd());
  }

  await $`git diff --cached --check`.cwd(process.cwd());
}

await main();
