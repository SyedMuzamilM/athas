#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import process from "node:process";

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function parseVersionTag(tag) {
  const match = tag.match(/^v(\d+\.\d+\.\d+)(?:-(alpha|beta|rc)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid version tag: ${tag}`);
  }

  return {
    version: match[1] + (match[2] ? `-${match[2]}.${match[3]}` : ""),
    channel: match[2] ?? null,
    isPrerelease: Boolean(match[2]),
  };
}

function getPreviousTag(currentTag) {
  const tags = runGit(["tag", "--sort=-v:refname", "--list", "v*"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return tags.find((tag) => tag !== currentTag) ?? null;
}

function getCommitSubjects(previousTag, currentTag) {
  const range = previousTag ? `${previousTag}..${currentTag}` : currentTag;
  const output = runGit(["log", range, "--pretty=format:%s"]);
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("Prepare "));
}

function cleanTitle(title) {
  return title.replace(/\s+\(#\d+\)$/, "").trim();
}

function dedupe(items) {
  return [...new Set(items)];
}

function titleLooksLikeDocs(title) {
  return title.includes("docs") || title.includes("documentation") || title.startsWith("doc:");
}

function sectionForPullRequest(pullRequest) {
  const labels = pullRequest.labels.map((label) => label.toLowerCase());
  const title = pullRequest.title.toLowerCase();
  const hasLabel = (value) => labels.some((label) => label === value || label.includes(value));

  if (hasLabel("docs") || titleLooksLikeDocs(title)) return "Docs";
  if (hasLabel("ai") || title.includes("ai") || title.includes("agent") || title.includes("llm")) {
    return "AI";
  }
  if (
    hasLabel("git") ||
    hasLabel("github") ||
    title.includes("git") ||
    title.includes("github") ||
    title.includes("pull request") ||
    title.includes("blame")
  ) {
    return "Git";
  }
  if (
    hasLabel("terminal") ||
    hasLabel("shell") ||
    title.includes("terminal") ||
    title.includes("shell") ||
    title.includes("ssh")
  ) {
    return "Terminal";
  }
  if (
    hasLabel("extensions") ||
    hasLabel("theme") ||
    hasLabel("lsp") ||
    hasLabel("syntax") ||
    title.includes("theme") ||
    title.includes("extension") ||
    title.includes("lsp") ||
    title.includes("tree-sitter") ||
    title.includes("syntax")
  ) {
    return "Extensions";
  }
  if (
    hasLabel("windows") ||
    hasLabel("macos") ||
    hasLabel("linux") ||
    hasLabel("platform") ||
    hasLabel("release") ||
    hasLabel("updater") ||
    hasLabel("build") ||
    title.includes("windows") ||
    title.includes("macos") ||
    title.includes("linux") ||
    title.includes("appimage") ||
    title.includes("signing") ||
    title.includes("release") ||
    title.includes("updater") ||
    title.includes("packaging")
  ) {
    return "Platform";
  }
  if (
    hasLabel("editor") ||
    hasLabel("ui") ||
    hasLabel("ux") ||
    hasLabel("settings") ||
    hasLabel("accessibility") ||
    title.includes("editor") ||
    title.includes("command palette") ||
    title.includes("file tree") ||
    title.includes("sidebar") ||
    title.includes("tab") ||
    title.includes("search") ||
    title.includes("accessibility") ||
    title.includes("settings")
  ) {
    return "Editor";
  }

  return "Other";
}

async function fetchGitHubJson(pathname, token) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "athas-release-notes",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body}`);
  }

  return response.json();
}

async function getPullRequestsForRange(owner, repo, previousTag, currentTag, token) {
  if (!previousTag) {
    return [];
  }

  const compare = await fetchGitHubJson(
    `/repos/${owner}/${repo}/compare/${previousTag}...${currentTag}`,
    token,
  );
  const pullRequests = new Map();

  for (const commit of compare.commits ?? []) {
    const associatedPulls = await fetchGitHubJson(
      `/repos/${owner}/${repo}/commits/${commit.sha}/pulls`,
      token,
    );

    for (const pullRequest of associatedPulls) {
      if (!pullRequest?.number || pullRequests.has(pullRequest.number) || !pullRequest.merged_at) {
        continue;
      }

      pullRequests.set(pullRequest.number, {
        number: pullRequest.number,
        title: cleanTitle(pullRequest.title),
        author: pullRequest.user?.login ?? "unknown",
        labels: (pullRequest.labels ?? []).map((label) => label.name).filter(Boolean),
        mergedAt: pullRequest.merged_at,
      });
    }
  }

  return [...pullRequests.values()].sort((left, right) => {
    return new Date(left.mergedAt).getTime() - new Date(right.mergedAt).getTime();
  });
}

function buildNotes({
  currentTag,
  previousTag,
  release,
  pullRequests,
  commitSubjects,
  repository,
}) {
  const lines = [];
  const sections = ["Editor", "AI", "Git", "Terminal", "Extensions", "Platform", "Docs", "Other"];

  if (release.isPrerelease) {
    const article = /^[aeiou]/i.test(release.channel) ? "an" : "a";
    lines.push("## Preview build", "");
    lines.push(
      `This is ${article} ${release.channel} build for testing before the next stable release.`,
      "",
    );
  }

  if (pullRequests.length > 0) {
    const grouped = new Map(sections.map((section) => [section, []]));

    for (const pullRequest of pullRequests) {
      const section = sectionForPullRequest(pullRequest);
      grouped.get(section).push(`- ${pullRequest.title} by @${pullRequest.author}`);
    }

    for (const section of sections) {
      const entries = grouped.get(section);
      if (!entries || entries.length === 0) continue;

      lines.push(`## ${section}`, "");
      lines.push(...entries, "");
    }

    const contributors = dedupe(pullRequests.map((pullRequest) => `@${pullRequest.author}`));
    if (contributors.length > 0) {
      lines.push("## Contributors", "");
      for (const contributor of contributors) {
        lines.push(`- ${contributor}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Changes", "");
    if (commitSubjects.length === 0) {
      lines.push("- No changes were detected for this release.", "");
    } else {
      for (const subject of commitSubjects) {
        lines.push(`- ${subject}`);
      }
      lines.push("");
    }
  }

  if (previousTag) {
    lines.push(
      `Full changelog: https://github.com/${repository}/compare/${previousTag}...${currentTag}`,
    );
  } else {
    lines.push(`Release history: https://github.com/${repository}/releases`);
  }

  return lines.join("\n").trim();
}

async function writeGitHubOutput(outputPath, values) {
  const content = [
    `release_name=${values.releaseName}`,
    `is_prerelease=${values.isPrerelease ? "true" : "false"}`,
    `previous_tag=${values.previousTag ?? ""}`,
    "release_body<<EOF",
    values.releaseBody,
    "EOF",
  ].join("\n");

  await Bun.write(outputPath, `${content}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const currentTag = args.tag ?? process.env.GITHUB_REF_NAME;

  if (!currentTag) {
    throw new Error("Missing release tag. Use --tag v1.2.3 or set GITHUB_REF_NAME.");
  }

  const previousTag = args["previous-tag"] ?? getPreviousTag(currentTag);
  const repository = args.repo ?? process.env.GITHUB_REPOSITORY ?? "athasdev/athas";
  const githubOutput = args["github-output"] ?? null;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  const [owner, repo] = repository.split("/");
  const release = parseVersionTag(currentTag);

  let pullRequests = [];
  if (token && owner && repo) {
    try {
      pullRequests = await getPullRequestsForRange(owner, repo, previousTag, currentTag, token);
    } catch (error) {
      console.warn(
        `Warning: failed to fetch pull requests for release notes, falling back to git log.\n${String(error)}`,
      );
    }
  }

  const commitSubjects = getCommitSubjects(previousTag, currentTag);
  const releaseName = release.isPrerelease
    ? `Athas v${release.version} prerelease`
    : `Athas v${release.version}`;
  const releaseBody = buildNotes({
    currentTag,
    previousTag,
    release,
    pullRequests,
    commitSubjects,
    repository,
  });

  if (githubOutput) {
    await writeGitHubOutput(githubOutput, {
      releaseName,
      releaseBody,
      isPrerelease: release.isPrerelease,
      previousTag,
    });
    return;
  }

  process.stdout.write(
    JSON.stringify(
      {
        releaseName,
        releaseBody,
        isPrerelease: release.isPrerelease,
        previousTag,
      },
      null,
      2,
    ) + "\n",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
