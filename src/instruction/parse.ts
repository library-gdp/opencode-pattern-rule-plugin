import { parse as parseYaml } from "yaml";

/** 지침 파일 하나 (FR-2) */
export interface Instruction {
  /** 지침 파일 경로. 프로젝트 지침은 프로젝트 디렉터리 기준 상대 경로, 전역 지침은 절대 경로입니다. */
  source: string;
  /** 적용 대상 glob 목록. 비어 있으면 세션 시작부터 적용하는 항상 적용 지침입니다 (FR-4). */
  paths: string[];
  body: string;
}

export interface ParseInstructionInput {
  source: string;
  text: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

/** frontmatter(`paths`)와 본문을 읽습니다. 형식이 잘못되면 예외를 던집니다. */
export function parseInstruction({ source, text }: ParseInstructionInput): Instruction {
  const match = FRONTMATTER.exec(text);
  if (!match) return { source, paths: [], body: text.trim() };

  const frontmatter: unknown = parseYaml(match[1] ?? "") ?? {};
  if (!isRecord(frontmatter)) throw new Error(`${source}: frontmatter는 객체여야 합니다`);

  return {
    source,
    paths: parsePaths(frontmatter["paths"], source),
    body: (match[2] ?? "").trim(),
  };
}

function parsePaths(value: unknown, source: string): string[] {
  if (value === undefined || value === null) return [];
  const items = typeof value === "string" ? splitTopLevelCommas(value) : value;
  if (!Array.isArray(items) || !items.every((item) => typeof item === "string")) {
    throw new Error(`${source}: "paths"는 문자열 목록이거나 쉼표로 구분한 문자열이어야 합니다`);
  }
  return items.map((item) => item.trim()).filter((item) => item !== "");
}

/**
 * 중괄호 밖의 쉼표에서만 나눕니다. `{test,spec}` 같은 중괄호 확장 안의 쉼표는 glob의 일부입니다.
 * `\`로 이스케이프한 문자는 구분자나 중괄호로 취급하지 않습니다.
 */
function splitTopLevelCommas(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === "\\") {
      i++;
    } else if (char === "{") {
      depth++;
    } else if (char === "}" && depth > 0) {
      depth--;
    } else if (char === "," && depth === 0) {
      items.push(value.slice(start, i));
      start = i + 1;
    }
  }
  items.push(value.slice(start));
  return items;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
