---
name: conditional-instruction
description: conditional instruction 파일(`.opencode/conditional-instructions/**/*.md` 또는 `~/.config/opencode/conditional-instructions/**/*.md`)을 만들거나 고칠 때 쓰는 템플릿과 형식. 사용자가 conditional instruction(조건부 지침) 작성·추가·수정을 명시적으로 요청할 때만 사용한다. AGENTS.md, opencode.json의 instructions, skill, 일반 프롬프트 작성에는 쓰지 않는다.
---

# Conditional Instruction 파일 형식

## 위치

| scope | 디렉터리 |
|---|---|
| 프로젝트 | `<OpenCode를 실행한 디렉터리>/.opencode/conditional-instructions/` |
| 유저 | `~/.config/opencode/conditional-instructions/` (`$XDG_CONFIG_HOME`이 있으면 `$XDG_CONFIG_HOME/opencode/conditional-instructions/`) |

- 디렉터리 아래 모든 `.md` 파일을 읽는다. 하위 디렉터리를 써도 된다.
- 두 scope 모두 `paths`는 **OpenCode를 실행한 디렉터리 기준 상대 경로**로 매칭한다. git 저장소 여부는 관계없다.
- 유저 scope는 플러그인 옵션 `global: false`(또는 `CONDITIONAL_INSTRUCTIONS_GLOBAL=false`)이면 읽지 않는다.

## 템플릿

```markdown
---
paths:
  - "<glob>"
sessionStart: true
---

# <제목>
- <지침>
```

## Frontmatter

| 필드 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `paths` | 문자열 목록 또는 쉼표로 구분한 문자열 | 없음 | 지침을 적용할 파일 glob. 생략하면 세션 시작부터 항상 적용한다. |
| `sessionStart` | boolean | `true` | `true`면 OpenCode를 실행한 디렉터리가 glob의 고정 접두부(`src/api/**/*.ts` → `src/api`)와 같거나 그 아래일 때 세션 시작부터 적용한다. `false`면 일치하는 파일에 접근할 때만 적용한다. |

- frontmatter가 없으면 항상 적용 지침이 된다.
- 다른 필드는 무시한다. 타입이 틀리면 그 파일은 경고와 함께 건너뛴다.
- glob은 `/` 구분자, `**`, `{a,b}` 중괄호 확장, dot 파일 매칭을 지원한다.

`paths` 작성 형식:

```yaml
# YAML list
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{test,spec}.ts"

# 쉼표로 구분한 문자열
paths: "src/api/**/*.ts, src/**/*.{test,spec}.ts"
```

## 본문

- frontmatter 아래 Markdown 전체가 지침 본문이다.
- 본문은 기본 8KB(`maxBytes`)를 넘으면 잘린다.

## 예시

프로젝트 scope — `.opencode/conditional-instructions/api.md`:

```markdown
---
paths:
  - "src/api/**/*.ts"
---

# API 지침
- 모든 handler는 zod로 입력을 검증한다.
```

유저 scope — `~/.config/opencode/conditional-instructions/tests.md`:

```markdown
---
paths: "**/*.{test,spec}.{ts,tsx}"
sessionStart: false
---

# 테스트 지침
- 테스트 이름은 한국어로 작성한다.
```
