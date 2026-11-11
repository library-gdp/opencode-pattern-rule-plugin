# OpenCode Pattern Rule Plugin

OpenCode에서 경로 기반 conditional instruction을 제공하는 플러그인입니다. 에이전트가 특정 경로의 파일에 접근할 때만 그 경로와 일치하는 지침을 context에 넣습니다.

## Why this exists

Claude Code의 `.claude/rules/`는 frontmatter에 `paths:` glob을 적어 두면 해당 경로의 파일에 접근할 때만 규칙을 context에 넣습니다. `AGENTS.md`처럼 항상 적용되는 지침과 달리, 필요한 순간에만 규칙을 넣어 context를 아낄 수 있습니다.

OpenCode에는 이 기능이 없습니다. `opencode.json`의 `instructions`에 glob을 쓸 수 있지만, 이는 어떤 파일을 불러올지만 정할 뿐 불러온 내용은 항상 system prompt에 들어갑니다. 이 플러그인은 그 빈자리를 채웁니다.

## Quickstart

1. 플러그인을 빌드하고 OpenCode에 설치합니다.

   ```bash
   npm install
   npm run opencode:install
   ```

   `opencode debug paths`로 OpenCode의 설정 디렉터리(기본 `~/.config/opencode`)를 찾아 `plugins/conditional-instructions.js`로 복사합니다. OpenCode가 이 디렉터리의 플러그인을 자동으로 로드하므로 `opencode.json`은 고치지 않아도 됩니다. 제거하려면 `npm run opencode:uninstall`을 실행합니다.

2. 프로젝트에 지침 파일을 추가합니다.

   ```bash
   mkdir -p .opencode/conditional-instructions
   cat > .opencode/conditional-instructions/api.md <<'EOF'
   ---
   paths:
     - "src/api/**/*.ts"
   ---

   # API 지침
   - 모든 handler는 zod로 입력을 검증한다.
   EOF
   ```

3. OpenCode를 실행합니다. 에이전트가 `src/api/` 아래의 `.ts` 파일에 접근하면 위 지침이 context에 들어갑니다.

## How to create Conditional Instruction

### 파일 위치

| 위치 | 범위 |
|---|---|
| `<worktree>/.opencode/conditional-instructions/**/*.md` | 프로젝트 |
| `~/.config/opencode/conditional-instructions/**/*.md` | 전역 |

`paths`는 두 위치 모두 worktree 루트 기준 상대 경로로 매칭합니다.

### 파일 형식

Markdown 파일 상단의 frontmatter에 적용 조건을 적고, 본문에 지침을 적습니다.

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/**/*.{test,spec}.ts"
sessionStart: true
---

# API 지침
- 모든 handler는 zod로 입력을 검증한다.
```

| 필드 | 설명 |
|---|---|
| `paths` | 지침을 적용할 파일의 glob 목록. YAML list 또는 쉼표로 구분한 문자열로 적습니다. `{ts,tsx}` 같은 중괄호 확장과 dot 파일 매칭을 지원합니다. 생략하면 세션 시작부터 항상 적용합니다. |
| `sessionStart` | `true`(기본값)이면 OpenCode를 실행한 디렉터리가 glob의 고정 접두부(예: `src/api/**/*.ts`의 `src/api`)와 같거나 그 아래일 때 세션 시작부터 지침을 적용합니다. `false`이면 파일에 접근할 때만 적용합니다. |

### 적용 시점

- `read`, `edit`, `write`, `patch` 도구로 파일에 접근하거나 `bash`에서 `cat`, `head` 등으로 파일을 읽으면, 그 경로와 일치하는 지침을 넣습니다.
- 같은 지침은 한 세션에 한 번만 넣습니다.
- 세션 도중 지침 파일을 수정·추가·삭제하면 이후 매칭에 반영합니다.
