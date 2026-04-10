#!/usr/bin/env bun

import { $ } from "bun";
import process from "node:process";
import path from "node:path";

type Channel = "prod" | "alpha";

// Examples:
//   bun smoke
//   bun smoke alpha
//   bun smoke prod
//   bun smoke:alpha
//   bun smoke:prod

const channelArg = (process.argv[2] ?? "alpha").toLowerCase();

if (channelArg !== "prod" && channelArg !== "alpha") {
  console.error("Usage: bun smoke [alpha|prod]");
  process.exit(1);
}

const channel = channelArg as Channel;

const targets: Record<Channel, { config?: string; macosAppName: string }> = {
  prod: {
    macosAppName: "Athas.app",
  },
  alpha: {
    config: "src-tauri/tauri.alpha.conf.json",
    macosAppName: "Athas Alpha.app",
  },
};

const target = targets[channel];
const buildArgs = ["tauri", "build", "--debug"];

if (process.platform === "darwin") {
  buildArgs.push("--bundles", "app");
} else {
  buildArgs.push("--no-bundle");
}

if (process.platform === "darwin") {
  buildArgs.push("--skip-stapling");
}

if (target.config) {
  buildArgs.push("--config", target.config);
}

await $`bunx ${buildArgs}`.cwd(process.cwd());

switch (process.platform) {
  case "darwin": {
    const appPath = `target/debug/bundle/macos/${target.macosAppName}`;
    await $`open -n ${appPath}`.cwd(process.cwd());
    break;
  }
  case "linux": {
    const binaryPath = path.join(process.cwd(), "target", "debug", "athas");
    const child = Bun.spawn([binaryPath], {
      cwd: process.cwd(),
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref();
    break;
  }
  case "win32": {
    const binaryPath = path.join(process.cwd(), "target", "debug", "athas.exe");
    const child = Bun.spawn(["cmd", "/c", "start", "", binaryPath], {
      cwd: process.cwd(),
      detached: true,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref();
    break;
  }
  default:
    console.log("Smoke build completed.");
    break;
}
