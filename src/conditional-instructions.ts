import { loadInstructions } from "./instruction/load.js";
import type { Instruction } from "./instruction/parse.js";
import { renderInstruction } from "./instruction/render.js";
import { selectAlwaysApplied, selectForFile } from "./matching/select.js";
import type { Options } from "./options.js";
import { SessionTracker } from "./session/tracker.js";
import { extractToolPaths } from "./tool/extract-paths.js";

export interface ConditionalInstructionsInput {
  /** OpenCode를 실행한 디렉터리. 프로젝트 지침 위치와 경로 매칭의 기준입니다. */
  projectDir: string;
  /** OpenCode user scope 설정 디렉터리 */
  configDir: string;
  options: Options;
  /** 경고와 디버그 로그 출력. 기본은 console.warn */
  log?: (message: string) => void;
}

export interface ToolExecution {
  sessionID: string;
  tool: string;
  args: unknown;
}

export interface ConditionalInstructions {
  /** `tool.execute.after`: 도구 결과 뒤에 덧붙일 텍스트. 넣을 지침이 없으면 `""` */
  onToolExecuted(execution: ToolExecution): Promise<string>;
  /**
   * `experimental.chat.system.transform`: system에 넣을 `paths` 없는 지침 (FR-4).
   * `paths`가 있는 지침은 넣지 않습니다. 세션마다 처음 구한 값을 계속 돌려줍니다 (NFR-1).
   */
  systemInstructions(sessionID: string): Promise<string[]>;
  /** `experimental.session.compacting`: 도구 결과로 넣었던 지침을 요약에 남깁니다 (FR-7). */
  compactionContext(sessionID: string): Promise<string[]>;
  forgetSession(sessionID: string): void;
}

export function createConditionalInstructions(input: ConditionalInstructionsInput): ConditionalInstructions {
  const { projectDir, configDir, options } = input;
  const log = input.log ?? ((message: string) => console.warn(`[conditional-instructions] ${message}`));
  const debug = (message: string) => {
    if (options.debug) log(message);
  };

  const tracker = new SessionTracker();
  const systemBySession = new Map<string, Promise<string[]>>();
  const injectedBySession = new Map<string, string[]>();

  async function load(): Promise<Instruction[]> {
    const { instructions, warnings } = await loadInstructions({ projectDir, configDir, global: options.global });
    warnings.forEach(log);
    return instructions;
  }

  function render(instruction: Instruction, triggeredBy?: string): string {
    const { text, warnings } = renderInstruction(instruction, {
      maxBytes: options.maxBytes,
      ...(triggeredBy === undefined ? {} : { triggeredBy }),
    });
    warnings.forEach(log);
    return text;
  }

  async function computeSystem(sessionID: string): Promise<string[]> {
    const texts: string[] = [];
    for (const instruction of selectAlwaysApplied(await load())) {
      if (!tracker.claim(sessionID, instruction.source)) continue;
      debug(`${sessionID}: 세션 시작 시 ${instruction.source} 적용`);
      texts.push(render(instruction));
    }
    return texts;
  }

  return {
    async onToolExecuted({ sessionID, tool, args }) {
      const files = extractToolPaths({ tool, args }, { projectDir, options });
      if (files.length === 0) return "";
      debug(`${sessionID}: ${tool} → ${files.join(", ")}`);

      const instructions = await load();
      const texts: string[] = [];
      for (const file of files) {
        for (const instruction of selectForFile(instructions, file)) {
          if (!tracker.claim(sessionID, instruction.source)) continue;
          debug(`${sessionID}: ${file}로 ${instruction.source} 적용`);
          texts.push(render(instruction, file));
        }
      }
      if (texts.length === 0) return "";

      const injected = injectedBySession.get(sessionID) ?? [];
      injected.push(...texts);
      injectedBySession.set(sessionID, injected);
      return texts.join("\n\n");
    },

    systemInstructions(sessionID) {
      let system = systemBySession.get(sessionID);
      if (!system) {
        system = computeSystem(sessionID);
        systemBySession.set(sessionID, system);
      }
      return system;
    },

    async compactionContext(sessionID) {
      return [...(injectedBySession.get(sessionID) ?? [])];
    },

    forgetSession(sessionID) {
      tracker.forget(sessionID);
      systemBySession.delete(sessionID);
      injectedBySession.delete(sessionID);
    },
  };
}
