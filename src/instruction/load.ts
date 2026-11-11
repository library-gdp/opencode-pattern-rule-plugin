import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { type Instruction, parseInstruction } from "./parse.js";

/** `<worktree>/.opencode/` 또는 `<configDir>/` 아래의 지침 디렉터리 이름 */
export const INSTRUCTIONS_DIR_NAME = "conditional-instructions";

export interface LoadInstructionsInput {
  worktree: string;
  /** OpenCode user scope 설정 디렉터리 */
  configDir: string;
  /** 전역 지침 위치를 읽을지 여부 */
  global: boolean;
}

export interface LoadInstructionsResult {
  instructions: Instruction[];
  warnings: string[];
}

/**
 * 프로젝트와 전역 위치의 지침 파일을 모두 읽습니다 (FR-1).
 * 캐시하지 않으므로 부를 때마다 수정·추가·삭제가 반영됩니다 (FR-8).
 * 읽거나 파싱하지 못한 파일은 건너뛰고 경고로 돌려줍니다 (NFR-2).
 */
export async function loadInstructions(input: LoadInstructionsInput): Promise<LoadInstructionsResult> {
  const warnings: string[] = [];
  const roots = [path.join(input.worktree, ".opencode", INSTRUCTIONS_DIR_NAME)];
  if (input.global) roots.push(path.join(input.configDir, INSTRUCTIONS_DIR_NAME));

  const instructions: Instruction[] = [];
  for (const root of roots) {
    for (const file of await listMarkdownFiles(root, warnings)) {
      const source = sourceOf(file, input.worktree);
      try {
        instructions.push(parseInstruction({ source, text: await readFile(file, "utf8") }));
      } catch (error) {
        warnings.push(`${source}: 지침을 읽을 수 없습니다 (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  }
  return { instructions, warnings };
}

async function listMarkdownFiles(root: string, warnings: string[]): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(root, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") warnings.push(`${root}: 읽을 수 없습니다 (${String(error)})`);
    return [];
  }
  return entries
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => path.join(root, entry));
}

/** worktree 안의 파일은 worktree 기준 상대 경로로, 밖의 파일은 절대 경로로 표시합니다. */
function sourceOf(file: string, worktree: string): string {
  const relative = path.relative(worktree, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return file;
  return relative.split(path.sep).join("/");
}
