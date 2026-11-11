/** 세션별로 이미 넣은 지침을 기억합니다 (FR-6). 서브에이전트 세션도 자기 sessionID로 따로 기록합니다. */
export class SessionTracker {
  readonly #applied = new Map<string, Set<string>>();

  /** 이 세션에서 처음 적용하는 지침이면 기록하고 true를 돌려줍니다. */
  claim(sessionID: string, source: string): boolean {
    let sources = this.#applied.get(sessionID);
    if (!sources) {
      sources = new Set();
      this.#applied.set(sessionID, sources);
    }
    if (sources.has(source)) return false;
    sources.add(source);
    return true;
  }

  /** 이 세션에 적용한 지침 출처를 적용한 순서대로 돌려줍니다. */
  applied(sessionID: string): string[] {
    return [...(this.#applied.get(sessionID) ?? [])];
  }

  forget(sessionID: string): void {
    this.#applied.delete(sessionID);
  }
}
