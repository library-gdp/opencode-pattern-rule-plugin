import type { Instruction } from "./parse.js";

export interface RenderInstructionInput {
  /** 지침을 켠 파일 경로. 항상 적용 지침처럼 계기가 없으면 생략합니다. */
  triggeredBy?: string;
  /** 본문의 최대 크기(byte) (NFR-3) */
  maxBytes: number;
}

export interface RenderInstructionResult {
  text: string;
  warnings: string[];
}

/** 지침을 context에 넣을 텍스트로 만듭니다. 출처와 지침을 켠 파일을 함께 표시합니다 (FR-3). */
export function renderInstruction(
  instruction: Instruction,
  { triggeredBy, maxBytes }: RenderInstructionInput,
): RenderInstructionResult {
  const warnings: string[] = [];
  let body = instruction.body;
  const bytes = Buffer.byteLength(body, "utf8");
  if (bytes > maxBytes) {
    body = `${truncateBytes(body, maxBytes)}\n…(${maxBytes}byte 상한을 넘어 잘림)`;
    warnings.push(`${instruction.source}: 지침이 ${bytes}byte로 상한 ${maxBytes}byte를 넘어 잘라냈습니다`);
  }

  const trigger = triggeredBy === undefined ? "" : ` triggered-by="${triggeredBy}"`;
  const text = `<conditional-instruction source="${instruction.source}"${trigger}>\n${body}\n</conditional-instruction>`;
  return { text, warnings };
}

/** UTF-8 문자 중간에서 자르지 않도록 maxBytes 이하로 자릅니다. */
function truncateBytes(text: string, maxBytes: number): string {
  const decoded = new TextDecoder().decode(Buffer.from(text, "utf8").subarray(0, maxBytes));
  return decoded.endsWith("�") ? decoded.slice(0, -1) : decoded;
}
