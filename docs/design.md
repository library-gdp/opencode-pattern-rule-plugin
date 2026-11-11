# OpenCode Pattern Rule Plugin: 설계 문서

> 상태: 제안 (Draft)
> 대상 버전: OpenCode 1.19.5 / `@opencode-ai/plugin@1.19.5`
> 작성일: 2026-11-11

## 1. 배경과 목표

Claude Code의 `.claude/rules/`는 frontmatter에 `paths:` glob을 적어 두면, **해당 경로의 파일에 접근할 때만** 규칙을 context에 넣습니다. `AGENTS.md`나 `CLAUDE.md`처럼 항상 적용되는 지침과 달리, 필요한 순간에만 규칙을 넣어 context를 아낄 수 있습니다.

OpenCode에는 이 기능이 없습니다.

- `opencode.json`의 `instructions`에 glob을 쓸 수 있지만, 이것은 **어떤 파일을 불러올지**만 정합니다. 불러온 내용은 항상 system prompt에 들어갑니다.
- `.claude/rules/` 디렉터리도 인식하지 않습니다.

**목표:** OpenCode 플러그인으로 Claude Code와 같은 방식의 경로 기반 조건부 규칙을 구현합니다.

### 범위

| 포함 | 제외 (향후 검토) |
|---|---|
| `paths:` glob 기반 조건부 규칙 | MCP 도구 인자 매칭 (기본 비활성) |
| `paths:` 없는 규칙 = 항상 적용 | 규칙 간 우선순위·충돌 해결 |
| `.opencode/rules/`, `.claude/rules/`(옵션), 전역 규칙 | GUI 설정 화면 |
| 세션 단위 중복 방지, compaction 대응 | |

## 2. 구현 가능성 검토

로컬에 설치된 `@opencode-ai/plugin@1.19.5`의 `dist/index.d.ts`에서 아래 hook을 확인했습니다.

| 목적 | Hook | 시그니처 요약 |
|---|---|---|
| 파일 접근 감지 + 규칙 주입 | `tool.execute.after` | `input: { tool, sessionID, callID, args }`, `output: { title, output, metadata }` (수정 가능) |
| system prompt 주입 | `experimental.chat.system.transform` | `input: { sessionID?, model }`, `output: { system: string[] }` |
| compaction 시 규칙 보존 | `experimental.session.compacting` | `input: { sessionID }`, `output: { context: string[], prompt? }` |
| 프롬프트 기반 매칭 (확장) | `chat.message` | `input: { sessionID, agent?, ... }`, `output: { message, parts }` |
| 세션 수명주기 | `event` | `session.compacted`, `session.deleted` 등 |

플러그인 초기화 인자 `PluginInput`에는 `directory`, `worktree`, `project`, `client`, `$`가 있습니다. 프로젝트 루트를 알 수 있으므로 상대 경로 매칭이 가능합니다.

**결론: 구현 가능합니다.** 핵심은 `tool.execute.after`에서 도구가 다룬 파일 경로를 뽑아내고, 매칭된 규칙을 도구 결과 뒤에 덧붙이는 것입니다.

> 참고: 최신 OpenCode 문서는 V2 API(`Plugin.define`, `ctx.tool.hook("execute.after")`, `ctx.session.instructions.entry.put()`)를 설명합니다. `instructions.entry`는 이런 용도를 위한 공식 수단으로 보이지만, 1.19.5의 `dist/v2` 타입에는 아직 없습니다. 그래서 V1 hook으로 구현하고, 매칭 로직을 hook과 분리해 두었다가 나중에 V2 adapter를 추가합니다.

## 3. 규칙 파일 형식

Claude Code와 형식을 맞춰 같은 파일을 양쪽에서 쓸 수 있게 합니다.

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{test,spec}.ts"   # 중괄호 확장: *.test.ts 와 *.spec.ts 둘 다 매칭
---

# API 규칙
- 모든 handler는 zod로 입력을 검증한다.
```

- `paths`는 목록(YAML list) 또는 쉼표로 구분한 문자열 모두 허용합니다.
- `{ts,tsx}` 같은 중괄호 확장을 지원합니다.
- `paths`가 없으면 **항상 적용** 규칙입니다.
- 확장 필드는 나중에 추가합니다(§9 참고).

### 탐색 위치

| 위치 | 기준 디렉터리 | 기본값 |
|---|---|---|
| `<worktree>/.opencode/rules/**/*.md` | worktree 루트 | 활성 |
| `<worktree>/.claude/rules/**/*.md` | worktree 루트 | 옵션 (`claudeCompat: true`) |
| `~/.config/opencode/rules/**/*.md` | worktree 루트 | 활성 |

## 4. 아키텍처

```
src/
  index.ts          # 플러그인 진입점 (V1 adapter 연결)
  config.ts         # 옵션 기본값과 병합
  loader.ts         # 규칙 탐색, frontmatter 파싱, mtime 캐시
  matcher.ts        # 경로 정규화와 glob 매칭 (picomatch)
  extract.ts        # 도구 호출 인자에서 대상 경로 추출
  state.ts          # 세션별 주입 기록
  render.ts         # 주입할 텍스트 포맷
  adapters/
    v1.ts           # 현재 hook 연결
    v2.ts           # (향후) instructions.entry 기반
```

핵심 로직(loader, matcher, extract, state, render)은 OpenCode API에 의존하지 않는 순수 모듈로 만듭니다. OpenCode API가 바뀌어도 adapter만 고치면 되고, 단위 테스트도 쉬워집니다.

### 처리 흐름

```
tool 실행 완료
  └─ tool.execute.after(input, output)
       ├─ extract(input.tool, input.args) → 절대 경로 목록
       ├─ 각 경로 → worktree 기준 상대 경로 (밖이면 무시)
       ├─ loader.rules() 중 matcher가 일치한 규칙
       ├─ state에서 이 세션에 이미 주입한 규칙 제외
       ├─ output.output += render(새 규칙)
       └─ state에 기록
```

## 5. 모듈 상세

### 5.1 loader

- 시작 시 탐색 위치를 glob으로 훑어 규칙 목록을 만듭니다.
- frontmatter는 `gray-matter`나 가벼운 YAML 파서로 파싱합니다.
- 규칙 ID는 파일의 절대 경로를 씁니다.
- 파일별 `mtime`을 캐시해 두고, 매칭할 때 바뀐 파일만 다시 읽습니다. 그러면 세션 도중 규칙을 고쳐도 반영됩니다.
- 파싱에 실패한 파일은 경고 로그만 남기고 건너뜁니다. 플러그인 전체가 실패하면 안 됩니다.

### 5.2 matcher

- 입력 경로를 절대 경로로 정규화한 뒤 `path.relative(worktree, abs)`로 바꿉니다.
- 결과가 `..`로 시작하면(프로젝트 밖) 매칭하지 않습니다.
- Windows 경로 구분자는 `/`로 통일합니다.
- 규칙별로 `picomatch(paths, { dot: true })`를 미리 컴파일해 둡니다.

### 5.3 extract

도구마다 인자 형태가 다르므로 테이블 방식으로 처리합니다.

| 도구 | 경로 위치 | 비고 |
|---|---|---|
| `read`, `edit`, `write` | `args.filePath` | |
| `patch` / `apply_patch` | `args.patchText` 안의 `*** (Add\|Update\|Delete) File: <path>` 줄 | 파일 여러 개 가능 |
| `list`, `glob`, `grep` | `args.path` | 기본 비활성. 디렉터리만 탐색해도 규칙이 켜지면 과도할 수 있음 |
| `bash` | `cat`/`head`/`tail`/`less` + 단일 파일 인자 | 최선 노력. 복잡한 파이프는 무시 |

- 도구 이름과 인자 구조는 버전마다 다를 수 있으므로 **PoC 단계에서 실제 값을 로그로 확인**하고 테이블을 확정합니다.
- 사용자가 옵션으로 테이블을 확장할 수 있게 합니다(예: MCP 도구 `{ tool: "fs_read", arg: "path" }`).

### 5.4 state

- `Map<sessionID, Set<ruleId>>`에 세션마다 주입한 규칙을 기록합니다.
- 서브에이전트(task 도구)는 sessionID가 따로 있으므로 자연스럽게 각자 다시 주입됩니다.
- `event`에서 `session.deleted`를 받으면 해당 항목을 지웁니다.
- `session.compacted`를 받으면 해당 세션의 기록을 초기화해서 이후 접근 때 다시 주입되게 합니다(§6.1).

### 5.5 render

```
<system-reminder>
The following project rules apply to files you just accessed (src/api/user.ts):

## Rule: .opencode/rules/api.md
<규칙 본문, frontmatter 제외>
</system-reminder>
```

- 규칙 출처와 그 규칙을 켠 파일 경로를 함께 적습니다. 모델이 규칙의 적용 범위를 알 수 있고, 디버깅도 쉬워집니다.
- 규칙 하나의 크기에 상한을 둡니다(예: 8KB, 옵션). 넘으면 잘라내고 경고합니다.

## 6. 주입 전략

| 방식 | 설명 | 장점 | 단점 |
|---|---|---|---|
| **A. 도구 결과에 덧붙이기 (기본)** | `tool.execute.after`에서 `output.output`에 추가 | Claude Code와 동작이 같음. 파일을 읽은 직후에 규칙이 보임. system prompt가 그대로라 prompt cache 유지 | 오래된 도구 결과가 prune되거나 compaction되면 규칙도 사라짐 |
| B. system prompt 누적 (옵션) | 세션의 활성 규칙을 `experimental.chat.system.transform`에서 매번 추가 | prune에 영향받지 않음 | 규칙이 새로 켜질 때마다 cache 무효화. 실험적 API |
| C. V2 `instructions.entry.put` (향후) | 공식 instructions API 사용 | B를 정석적으로 대체 | 1.19.5에는 없음 |

**결정:** A를 기본으로 하고, B는 `mode: "system"` 옵션으로 제공합니다. OpenCode가 V2 API를 안정화하면 C adapter를 추가합니다.

### 6.1 compaction 대응

방식 A에서는 compaction 후 규칙이 사라질 수 있으므로 두 가지를 함께 씁니다.

1. `experimental.session.compacting`에서 그 세션의 활성 규칙 **목록과 요약**을 `output.context`에 넣습니다. 요약 결과에 "어떤 규칙이 적용 중이었는지"가 남습니다.
2. `session.compacted` 이벤트를 받으면 해당 세션의 state를 초기화합니다. 다음에 그 파일에 접근하면 규칙 전문이 다시 주입됩니다.

### 6.2 항상 적용 규칙

`paths`가 없는 규칙은 다음 중 하나로 처리합니다.

- 방식 A일 때: `experimental.chat.system.transform`에 고정으로 넣습니다. 내용이 세션 내내 바뀌지 않으므로 cache 문제가 없습니다.
- 대안: 사용자에게 `opencode.json`의 `instructions`에 등록하도록 안내합니다. 실험적 hook을 피하고 싶을 때 씁니다.

## 7. 설정

`opencode.json`의 plugin 옵션으로 받습니다.

```jsonc
{
  "plugin": [
    ["opencode-pattern-rule-plugin", {
      "mode": "tool-output",          // "tool-output" | "system"
      "claudeCompat": true,           // .claude/rules/ 도 탐색
      "globalRules": true,            // ~/.config/opencode/rules/ 탐색
      "matchDirectoryTools": false,   // list/glob/grep의 path도 매칭
      "bashExtraction": true,         // bash의 cat/head 등에서 경로 추출
      "maxRuleBytes": 8192,
      "extraTools": [                 // 사용자 정의 도구 매핑
        { "tool": "fs_read", "arg": "path" }
      ],
      "debug": false                  // 매칭 과정 로그
    }]
  ]
}
```

## 8. 알려진 한계

- **edit/write 시점:** 규칙이 수정을 마친 **뒤에** 주입됩니다. Claude Code도 같고, 보통 수정 전에 read를 먼저 하므로 실제 영향은 작습니다. 필요하면 `tool.execute.before`에서 경고만 남기는 방안을 검토합니다.
- **실험적 hook:** `experimental.*`는 바뀔 수 있습니다. 지원 버전을 `peerDependencies`로 명시하고 adapter로 감쌉니다.
- **bash 추출의 한계:** 셸 문법 전체를 해석하지 않으므로 리다이렉션, 변수, 서브셸을 통한 접근은 놓칩니다.
- **MCP 도구:** 인자 이름이 제각각이라 기본으로는 매칭하지 않습니다. `extraTools`로 직접 등록해야 합니다.
- **도구 결과 크기:** 큰 규칙을 반복해서 붙이면 context가 커집니다. 세션 단위 중복 방지와 `maxRuleBytes`로 줄입니다.

## 9. 확장 아이디어

| 필드 | 의미 | 구현 hook |
|---|---|---|
| `keywords:` | 사용자 프롬프트에 키워드가 있으면 적용 | `chat.message` |
| `tools:` | 특정 도구 사용 시에만 적용 (예: `bash`) | `tool.execute.after` |
| `agents:` | 특정 에이전트(build/plan 등)에만 적용 | `chat.message`의 `agent` |
| `once: false` | 매 접근마다 다시 주입 | state 무시 |

## 10. 테스트 전략

- **단위 테스트 (bun test):** matcher(glob, 중괄호 확장, dot 파일, 프로젝트 밖 경로), extract(도구별 인자, patch 파싱, bash 명령), loader(frontmatter 형식, 파싱 실패), state(중복, 초기화).
- **통합 테스트:** fixture 프로젝트에 규칙을 두고, mock `PluginInput`으로 hook을 직접 호출해 `output.output` 변화를 확인합니다.
- **수동 E2E:** 실제 OpenCode에서 규칙 대상 파일을 읽게 하고, 모델이 규칙을 인지하는지 확인합니다.

## 11. 단계별 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1. PoC | `.opencode/plugins/`에 로깅 플러그인을 두고 `tool.execute.after`의 도구 이름과 인자를 수집 | extract 테이블 확정 |
| 2. MVP | loader, matcher, extract(read/edit/write), state, 방식 A, compaction 대응 | 경로 규칙이 한 세션에 한 번 주입됨 |
| 3. 호환·확장 | `.claude/rules/` 호환, patch·bash 추출, 방식 B 옵션, 항상 적용 규칙 | 설정 옵션 전체 동작 |
| 4. 배포 | npm 패키지, README, 예제 규칙 | `opencode.json`에 등록만으로 사용 가능 |
| 5. V2 | `instructions.entry` adapter | OpenCode V2 API 안정화 후 |

## 참고 자료

- [OpenCode Plugins](https://opencode.ai/docs/plugins/)
- [OpenCode Server Plugins (V2)](https://opencode.ai/docs/build/plugins/server)
- [OpenCode Rules](https://opencode.ai/docs/rules/)
- [Claude Code Memory / Rules](https://code.claude.com/docs/en/memory)
