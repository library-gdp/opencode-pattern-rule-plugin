#!/usr/bin/env node
// 플러그인을 단일 파일로 빌드해 OpenCode 전역 설정 디렉터리의 plugins/에 설치합니다.
//
//   node scripts/opencode-install.mjs [install] [--config-dir <dir>]
//   node scripts/opencode-install.mjs uninstall [--config-dir <dir>]
//   node scripts/opencode-install.mjs build
//
// OpenCode는 <config>/{plugin,plugins}/*.{ts,js}를 자동으로 로드하므로 opencode.json은 고치지 않습니다.

import { execFileSync } from "node:child_process";
import { copyFileSync, lstatSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_FILE = "conditional-instructions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUNDLE = path.join(ROOT, "dist", "bundle", PLUGIN_FILE);

/** `opencode debug paths` 출력에서 config 경로를 찾습니다. */
export function parseDebugPaths(output) {
  for (const line of output.split(/\r?\n/)) {
    const match = /^config\s+(.+?)\s*$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

/** opencode CLI가 없을 때 OpenCode와 같은 규칙으로 config 경로를 구합니다. */
export function fallbackConfigDir(env = process.env, home = homedir()) {
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(home, ".config");
  return path.join(base, "opencode");
}

export function resolveConfigDir({ explicit, env = process.env, run = runOpencodeDebugPaths } = {}) {
  if (explicit) return { dir: path.resolve(explicit), source: "--config-dir" };
  const output = run();
  const fromCli = output && parseDebugPaths(output);
  if (fromCli) return { dir: fromCli, source: "opencode debug paths" };
  return { dir: fallbackConfigDir(env), source: "XDG_CONFIG_HOME / ~/.config" };
}

function runOpencodeDebugPaths() {
  try {
    return execFileSync("opencode", ["debug", "paths"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 15_000,
      shell: process.platform === "win32",
    });
  } catch {
    return undefined;
  }
}

export function parseArgs(argv) {
  const args = { command: "install", configDir: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "install" || arg === "uninstall" || arg === "build") args.command = arg;
    else if (arg === "--config-dir") {
      const value = argv[++i];
      if (!value) throw new Error("--config-dir에 경로가 필요합니다");
      args.configDir = value;
    } else throw new Error(`알 수 없는 인자: ${arg}`);
  }
  return args;
}

function exists(file) {
  try {
    lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

async function build() {
  const { build } = await import("esbuild");
  await build({
    entryPoints: [path.join(ROOT, "src", "index.ts")],
    outfile: BUNDLE,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    // OpenCode가 제공하는 패키지는 번들에 넣지 않습니다. 현재는 타입만 쓰므로 실제 import는 없습니다.
    external: ["@opencode-ai/plugin", "@opencode-ai/sdk"],
    logLevel: "warning",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "build") {
    await build();
    console.log(`빌드했습니다: ${BUNDLE}`);
    return;
  }
  const { dir, source } = resolveConfigDir({ explicit: args.configDir });
  const target = path.join(dir, "plugins", PLUGIN_FILE);

  if (args.command === "uninstall") {
    if (exists(target)) {
      rmSync(target);
      console.log(`삭제했습니다: ${target}`);
    } else {
      console.log(`설치된 플러그인이 없습니다: ${target}`);
    }
    return;
  }

  await build();
  mkdirSync(path.dirname(target), { recursive: true });
  if (exists(target)) rmSync(target);
  copyFileSync(BUNDLE, target);

  console.log(`config 디렉터리: ${dir} (${source})`);
  console.log(`설치했습니다: ${target}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
