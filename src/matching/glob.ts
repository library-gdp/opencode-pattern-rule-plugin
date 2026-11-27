import picomatch from "picomatch";

export interface MatchOptions {
  /** 대소문자를 구분하지 않습니다. Windows 경로 패턴에 씁니다. */
  nocase?: boolean;
}

const matchers = new Map<string, picomatch.Matcher>();

/** 중괄호 확장과 dot 파일 매칭을 지원하는 glob 매칭 (FR-2). 경로 구분자는 `/`입니다. */
export function matchesGlob(pattern: string, file: string, { nocase = false }: MatchOptions = {}): boolean {
  const key = `${nocase ? "i" : "s"}:${pattern}`;
  let matcher = matchers.get(key);
  if (!matcher) {
    matcher = picomatch(pattern, { dot: true, nocase });
    matchers.set(key, matcher);
  }
  return matcher(file);
}
