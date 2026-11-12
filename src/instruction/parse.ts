import { parse as parseYaml } from "yaml";

/** 지침 파일 하나 (FR-2) */
export interface Instruction {
  /** 지침 파일 경로. 프로젝트 지침은 worktree 기준 상대 경로, 전역 지침은 절대 경로입니다. */
  source: string;
  /** 적용 대상 glob 목록. 비어 있으면 항상 적용 지침입니다 (FR-4). */
  paths: string[];
  /** 세션 시작 디렉터리 매칭 대상 여부 (FR-5) */
  sessionStart: boolean;
  body: string;
}

export interface ParseInstructionInput {
  source: string;
  text: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/** frontmatter(`paths`, `sessionStart`)와 본문을 읽습니다. 형식이 잘못되면 예외를 던집니다. */
export function parseInstruction({ source, text }: ParseInstructionInput): Instruction {
  const match = FRONTMATTER.exec(text);
  if (!match) return { source, paths: [], sessionStart: true, body: text.trim() };

  const frontmatter: unknown = parseYaml(match[1] ?? "") ?? {};
  if (!isRecord(frontmatter)) throw new Error(`${source}: frontmatter는 객체여야 합니다`);

  return {
    source,
    paths: parsePaths(frontmatter["paths"], source),
    sessionStart: parseSessionStart(frontmatter["sessionStart"], source),
    body: (match[2] ?? "").trim(),
  };
}

function parsePaths(value: unknown, source: string): string[] {
  if (value === undefined || value === null) return [];
  const items = typeof value === "string" ? value.split(",") : value;
  if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
    throw new Error(`${source}: "paths"는 문자열 목록이거나 쉼표로 구분한 문자열이어야 합니다`);
  }
  return items.map((item) => item.trim()).filter((item) => item !== "");
}

function parseSessionStart(value: unknown, source: string): boolean {
  if (value === undefined) return true;
  if (typeof value !== "boolean") throw new Error(`${source}: "sessionStart"는 boolean이어야 합니다`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
