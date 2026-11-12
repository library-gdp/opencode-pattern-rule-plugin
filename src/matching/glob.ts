import picomatch from "picomatch";

const matchers = new Map<string, picomatch.Matcher>();

/** 중괄호 확장과 dot 파일 매칭을 지원하는 glob 매칭 (FR-2). 경로 구분자는 `/`입니다. */
export function matchesGlob(pattern: string, file: string): boolean {
  let matcher = matchers.get(pattern);
  if (!matcher) {
    matcher = picomatch(pattern, { dot: true });
    matchers.set(pattern, matcher);
  }
  return matcher(file);
}

/** glob의 고정 접두부. 예: `src/api/**\/*.ts` → `src/api`, `**\/*.ts` → `""` (FR-5) */
export function globBase(pattern: string): string {
  return picomatch.scan(pattern).base;
}
