#!/usr/bin/env bun

import { $ } from "bun";
import { appendFileSync } from "node:fs";

const args = process.argv.slice(2);

function getArg(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function shellQuote(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function text(command) {
  return (await $`bash -lc ${command}`.text()).trim();
}

async function getPreviousTag(tag) {
  try {
    return await text(`git describe --tags --abbrev=0 ${shellQuote(`${tag}^`)}`);
  } catch {
    const tags = await text("git tag --sort=-creatordate --merged HEAD");
    return tags
      .split("\n")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .find((entry) => entry !== tag);
  }
}

async function getComparableRevision(tag) {
  try {
    await text(`git rev-parse --verify ${shellQuote(tag)}`);
    return tag;
  } catch {
    return "HEAD";
  }
}

async function getCommitSubjects(previousTag, tag) {
  const revision = await getComparableRevision(tag);
  const range = previousTag ? `${previousTag}..${revision}` : revision;
  const output = await text(`git log ${shellQuote(range)} --pretty=format:%s`);
  return output
    .split("\n")
    .map((subject) => subject.trim())
    .filter(Boolean)
    .filter((subject) => !subject.startsWith("Prepare release"))
    .filter((subject) => !subject.startsWith("Prepare alpha release"))
    .filter((subject, index, subjects) => subjects.indexOf(subject) === index);
}

function includesAny(subjects, patterns) {
  return subjects.some((subject) => patterns.some((pattern) => pattern.test(subject)));
}

function categorize(subjects) {
  const categories = [
    {
      title: "Debugger",
      patterns: [/debug/i, /breakpoint/i, /stack/i, /variables/i],
    },
    {
      title: "AI and agents",
      patterns: [
        /\bAI\b/i,
        /\bagent/i,
        /\bACP\b/i,
        /provider/i,
        /model/i,
        /Ollama/i,
        /OpenRouter/i,
      ],
    },
    {
      title: "Git and GitHub",
      patterns: [/\bgit\b/i, /GitHub/i, /\bPR\b/i, /branch/i],
    },
    {
      title: "Editor and terminal",
      patterns: [/editor/i, /terminal/i, /markdown/i, /LSP/i, /language/i, /tab/i],
    },
    {
      title: "Settings and interface",
      patterns: [
        /settings/i,
        /sidebar/i,
        /selector/i,
        /dialog/i,
        /chrome/i,
        /toast/i,
        /keybinding/i,
      ],
    },
    {
      title: "Database, search, and tooling",
      patterns: [/database/i, /search/i, /SQLite/i, /Postgres/i, /MySQL/i, /tool/i, /CI/i],
    },
    {
      title: "Reliability and release",
      patterns: [/fix/i, /stabilize/i, /harden/i, /security/i, /release/i, /auth/i, /Windows/i],
    },
  ];

  const used = new Set();
  const grouped = [];

  for (const category of categories) {
    const items = subjects.filter((subject) => {
      if (used.has(subject)) return false;
      return category.patterns.some((pattern) => pattern.test(subject));
    });

    if (items.length > 0) {
      items.forEach((item) => used.add(item));
      grouped.push({ title: category.title, items });
    }
  }

  const other = subjects.filter((subject) => !used.has(subject));
  if (other.length > 0) {
    grouped.push({ title: "Other changes", items: other });
  }

  return grouped;
}

function buildHighlights(subjects) {
  const highlights = [];

  if (includesAny(subjects, [/debug/i, /breakpoint/i, /stack/i, /variables/i])) {
    highlights.push(
      "Introduces the new debugger foundation, including launch configurations, adapter sessions, breakpoints, stack frames, variables, console output, and watch expressions.",
    );
  }

  if (includesAny(subjects, [/AI/i, /agent/i, /provider/i, /model/i, /Ollama/i, /OpenRouter/i])) {
    highlights.push(
      "Refreshes the AI experience with cleaner provider and model controls, new provider/model coverage, ACP agent polish, and more reliable context handling.",
    );
  }

  if (includesAny(subjects, [/GitHub/i, /PR/i, /git/i])) {
    highlights.push(
      "Improves Git and GitHub workflows with richer issue, pull request, action, diff, branch, and command-palette integrations.",
    );
  }

  if (includesAny(subjects, [/settings/i, /sidebar/i, /selector/i, /chrome/i, /keybinding/i])) {
    highlights.push(
      "Polishes settings, keybindings, sidebar behavior, selectors, custom chrome, and other high-traffic interface surfaces.",
    );
  }

  if (includesAny(subjects, [/search/i, /database/i, /web viewer/i, /terminal/i, /LSP/i])) {
    highlights.push(
      "Strengthens core editor workflows across global search, database browsing, embedded webviews, terminal behavior, LSP resolution, and language tooling.",
    );
  }

  if (includesAny(subjects, [/security/i, /release/i, /CI/i, /Windows/i])) {
    highlights.push(
      "Tightens release readiness with CI, dependency, security, Windows, and release-check improvements.",
    );
  }

  return highlights;
}

function formatBody(tag, previousTag, subjects) {
  const highlights = buildHighlights(subjects);
  const grouped = categorize(subjects);
  const lines = [];

  lines.push(`## Athas ${tag}`);
  lines.push("");
  lines.push(
    `This alpha release collects the work since ${previousTag ?? "the previous release"} and is intended for early validation before the next stable build.`,
  );
  lines.push("");

  if (highlights.length > 0) {
    lines.push("### Highlights");
    for (const highlight of highlights) {
      lines.push(`- ${highlight}`);
    }
    lines.push("");
  }

  lines.push("### Changes");
  for (const group of grouped) {
    lines.push(`#### ${group.title}`);
    for (const item of group.items.slice(0, 12)) {
      lines.push(`- ${item}`);
    }
    if (group.items.length > 12) {
      const label = group.title === "Other changes" ? "items" : "changes";
      lines.push(`- And ${group.items.length - 12} more ${group.title.toLowerCase()} ${label}.`);
    }
    lines.push("");
  }

  lines.push("### Notes");
  lines.push("- This is a prerelease and may still contain rough edges.");
  lines.push("- Please report debugger, AI provider, GitHub workflow, and packaging regressions.");

  return lines.join("\n");
}

function writeGithubOutput(path, outputs) {
  const chunks = [];
  for (const [key, value] of Object.entries(outputs)) {
    if (value.includes("\n")) {
      chunks.push(`${key}<<EOF_${key}\n${value}\nEOF_${key}`);
    } else {
      chunks.push(`${key}=${value}`);
    }
  }
  appendFileSync(path, `${chunks.join("\n")}\n`);
}

const tag = getArg("--tag") || process.env.GITHUB_REF_NAME;
if (!tag) {
  console.error("Missing --tag");
  process.exit(1);
}

const outputPath = getArg("--github-output");
const previousTag = await getPreviousTag(tag);
const subjects = await getCommitSubjects(previousTag, tag);
const releaseBody = formatBody(tag, previousTag, subjects);
const version = tag.replace(/^v/, "");
const isPrerelease = /-(alpha|beta|rc)\.\d+$/.test(version) ? "true" : "false";
const releaseName = `Athas ${tag}`;

if (outputPath) {
  writeGithubOutput(outputPath, {
    release_name: releaseName,
    release_body: releaseBody,
    is_prerelease: isPrerelease,
  });
} else {
  console.log(releaseBody);
}
