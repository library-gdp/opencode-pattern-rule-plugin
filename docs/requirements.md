# OpenCode 조건부 지침 플러그인: 요구사항과 OpenCode 스펙

> 상태: 제안 (Draft)
> 대상 버전: OpenCode 1.19.5 / `@opencode-ai/plugin@1.19.5`
> 작성일: 2026-11-11

## 1. 배경과 목표

Claude Code의 `.claude/rules/`는 frontmatter에 `paths:` glob을 적어 두면, **해당 경로의 파일에 접근할 때만** 규칙을 context에 넣습니다. `AGENTS.md`나 `CLAUDE.md`처럼 항상 적용되는 지침과 달리, 필요한 순간에만 규칙을 넣어 context를 아낄 수 있습니다.

OpenCode에는 이 기능이 없습니다.

- `opencode.json`의 `instructions`에 glob을 쓸 수 있지만, 이것은 **어떤 파일을 불러올지**만 정합니다. 불러온 내용은 항상 system prompt에 들어갑니다.

**목표:** OpenCode 플러그인으로 경로 기반 조건부 지침(conditional instruction)을 제공합니다.

## 2. 요구사항

### 2.1 기능 요구사항

**FR-1. 지침 파일 위치**

| 위치 | 경로 기준 |
|---|---|
| `<worktree>/.opencode/conditional-instructions/**/*.md` | worktree 루트 |
| `~/.config/opencode/conditional-instructions/**/*.md` (전역, 옵션으로 끌 수 있음) | worktree 루트 |

OpenCode 전용 위치에서만 읽습니다. `.claude/rules/` 등 다른 도구의 위치는 읽지 않습니다.

**FR-2. 지침 파일 형식**

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{test,spec}.ts"   # 중괄호 확장: *.test.ts 와 *.spec.ts 둘 다 매칭
---

# API 지침
- 모든 handler는 zod로 입력을 검증한다.
```

- `paths`는 목록(YAML list) 또는 쉼표로 구분한 문자열 모두 허용합니다.
- `{ts,tsx}` 같은 중괄호 확장과 dot 파일 매칭을 지원합니다.
- `sessionStart: false`를 적으면 세션 시작 디렉터리 매칭(FR-5)에서 제외합니다. 기본값은 `true`입니다.

**FR-3. 파일 접근 시 조건부 적용**

에이전트가 도구로 파일에 접근하면, 그 파일 경로와 일치하는 `paths`를 가진 지침을 context에 넣습니다.

| 도구 | 대상 | 기본 |
|---|---|---|
| `read`, `edit`, `write` | 대상 파일 | 활성 |
| `patch` / `apply_patch` | 패치에 포함된 모든 파일 | 활성 |
| `bash` | `cat`/`head`/`tail`/`less` 등으로 단일 파일을 읽는 명령 (최선 노력) | 활성 |
| `list`, `glob`, `grep` | 탐색 경로 | 비활성 (디렉터리 탐색만으로 켜지면 과도함) |
| 사용자 정의 도구 (MCP 등) | 설정으로 도구 이름과 경로 인자를 등록한 경우 | 등록 시 활성 |

- 경로는 worktree 기준 상대 경로로 매칭합니다. worktree 밖의 파일은 매칭하지 않습니다.
- 지침에는 출처(지침 파일 경로)와 그 지침을 켠 파일 경로를 함께 표시합니다.

**FR-4. 항상 적용 지침**

`paths`가 없는 지침은 세션 시작부터 항상 적용합니다.

**FR-5. 세션 시작 디렉터리 매칭**

OpenCode를 하위 디렉터리에서 실행하면, 그 디렉터리를 대상으로 하는 지침을 파일 접근 전인 세션 시작부터 적용합니다. 다음 조건을 모두 만족하는 glob이 하나라도 있으면 적용합니다.

1. glob의 고정 접두부(base)가 비어 있지 않다.
2. 세션 디렉터리가 base와 같거나 base 아래에 있다.

| 세션 디렉터리 | `paths:` | 적용 | 이유 |
|---|---|---|---|
| `src/api` | `src/api/**/*.ts` | O | base와 같음 |
| `src/api/v1` | `src/api/**/*.ts` | O | base 아래 |
| `src` | `src/api/**/*.ts` | X | 더 넓은 범위에서 작업 중. 실제 파일 접근 시 적용 |
| (루트) | `src/api/**/*.ts` | X | 위와 같음 |
| 어디든 | `**/*.ts` | X | base가 비어 있음. 허용하면 사실상 항상 적용 지침이 됨 |

옵션으로 기능 전체를 끌 수 있어야 합니다.

**FR-6. 세션 단위 중복 방지**

- 같은 지침은 한 세션에 한 번만 넣습니다. 세션 시작 시 적용한 지침도 포함합니다.
- 서브에이전트 세션은 별도 세션으로 취급해 따로 적용합니다.

**FR-7. compaction 이후 유지**

compaction 후에도 그 세션에서 적용 중이던 지침이 효력을 잃지 않아야 합니다. 요약에 남기거나, 이후 접근 시 다시 넣는 방식 모두 허용합니다.

**FR-8. 지침 변경 반영**

세션 도중 지침 파일을 수정·추가·삭제하면 이후 매칭에 반영합니다.

### 2.2 비기능 요구사항

- **NFR-1. prompt cache 보존:** 지침 주입 때문에 system prompt가 자주 바뀌어 prompt cache가 무효화되지 않도록 합니다.
- **NFR-2. 장애 격리:** 지침 파일 하나를 파싱하지 못해도 경고만 남기고 나머지는 정상 동작해야 합니다.
- **NFR-3. context 크기 제한:** 지침 하나의 크기에 상한(기본 8KB, 설정 가능)을 두고, 넘으면 잘라내고 경고합니다.
- **NFR-4. 설정 가능:** 위의 옵션 항목을 켜고 끌 수 있어야 합니다. 플러그인을 `<config>/plugins/`에 두면 OpenCode가 자동으로 로드하지만 plugin 옵션은 전달하지 않으므로, 다음 순서로 읽습니다. 앞에 있는 값이 우선합니다.
  1. 환경변수 `CONDITIONAL_INSTRUCTIONS_*`: 실행할 때마다 바꿀 때 씁니다. 예: `CONDITIONAL_INSTRUCTIONS_DISABLE=1 opencode`
  2. `opencode.json`의 plugin 옵션: `plugin` 배열에 `["…", { … }]` 형태로 등록한 경우
  3. `<config>/conditional-instructions.json`
  4. 기본값
- **NFR-5. 디버깅:** 매칭 과정을 로그로 확인할 수 있는 옵션을 제공합니다.

### 2.3 범위 제외

- 지침 간 우선순위·충돌 해결
- 사용자 프롬프트 키워드 기반 적용 (향후 검토)
- GUI 설정 화면

## 3. 이용할 수 있는 OpenCode 스펙

로컬에 설치된 `@opencode-ai/plugin@1.19.5`(`dist/index.d.ts`)와 `@opencode-ai/sdk`(`dist/gen/types.gen.d.ts`)에서 확인했습니다.

### 3.1 플러그인 hook

| 용도 | Hook | 시그니처 요약 |
|---|---|---|
| 도구 실행 후 결과 수정 | `tool.execute.after` | `input: { tool, sessionID, callID, args }`, `output: { title, output, metadata }` (수정 가능) |
| system prompt 수정 | `experimental.chat.system.transform` | `input: { sessionID?, model }`, `output: { system: string[] }` |
| compaction 직전 context 추가 | `experimental.session.compacting` | `input: { sessionID }`, `output: { context: string[], prompt? }` |
| 사용자 메시지 수신 | `chat.message` | `input: { sessionID, agent?, model?, messageID?, variant? }`, `output: { message, parts }` |
| 이벤트 구독 | `event` | `session.created`, `session.updated`, `session.compacted`, `session.deleted` 등 |

### 3.2 플러그인 초기화 인자 `PluginInput`

| 필드 | 내용 |
|---|---|
| `directory` | OpenCode를 실행한 디렉터리 |
| `worktree` | git worktree 루트 |
| `project` | 프로젝트 정보 |
| `client` | OpenCode SDK 클라이언트 (예: `client.session.get()`) |
| `$` | Bun shell |

### 3.3 `Session` 타입 (`@opencode-ai/sdk`)

`id`, `projectID`, `directory`, `parentID?` 등을 가집니다. `directory`로 세션 작업 디렉터리를, `parentID`로 서브에이전트 세션 여부를 알 수 있습니다.

### 3.4 V2 API

최신 OpenCode 문서는 V2 API(`Plugin.define`, `ctx.tool.hook("execute.after")`, `ctx.session.instructions.entry.put()`)를 설명합니다. `instructions.entry`는 이런 용도를 위한 공식 수단으로 보이지만, 1.19.5의 `dist/v2` 타입에는 아직 없습니다.

### 3.5 스펙상 제약

- **`experimental.*` hook:** 버전에 따라 바뀌거나 사라질 수 있습니다.
- **`tool.execute.after` 시점:** 도구 실행이 끝난 뒤 호출되므로, edit/write로 처음 접근한 파일의 지침은 수정이 끝난 뒤에 전달됩니다.
- **도구 이름과 인자:** 내장 도구의 이름과 `args` 구조는 버전마다 다를 수 있어 실제 값을 확인해야 합니다. 프롬프트의 `@파일` 첨부가 `tool.execute.after`를 거치는지도 확인이 필요합니다.
- **도구 결과 보존:** OpenCode가 오래된 도구 결과를 prune하거나 compaction하면 도구 결과에 덧붙인 내용도 사라집니다.

## 참고 자료

- [OpenCode Plugins](https://opencode.ai/docs/plugins/)
- [OpenCode Server Plugins (V2)](https://opencode.ai/docs/build/plugins/server)
- [OpenCode Rules](https://opencode.ai/docs/rules/)
- [Claude Code Memory / Rules](https://code.claude.com/docs/en/memory)
