import { homedir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Instruction } from "../../../src/instruction/parse.js";
import { selectAlwaysApplied, selectForFile } from "../../../src/matching/select.js";

function instruction(source: string, paths: string[]): Instruction {
  return { source, paths, body: `${source} 본문` };
}

const api = instruction("api.md", ["src/api/**/*.ts"]);
const tests = instruction("tests.md", ["src/**/*.{test,spec}.ts"]);
const always = instruction("always.md", []);
const projectDir = "/repo";

// FR-3. 파일 접근 시 조건부 적용
describe("selectForFile", () => {
  it("프로젝트 디렉터리 기준 상대 경로와 일치하는 지침을 고른다", () => {
    // Given
    const instructions = [api, tests, always];

    // When
    const selected = selectForFile(instructions, "src/api/users.test.ts", projectDir);

    // Then
    expect(selected).toEqual([api, tests]);
  });

  it("절대 경로 패턴은 프로젝트 디렉터리 안의 파일과 절대 경로로 비교한다", () => {
    // Given
    const absolute = instruction("absolute.md", ["/repo/src/api/**/*.ts"]);

    // When
    const selected = selectForFile([absolute], "src/api/users.ts", projectDir);

    // Then
    expect(selected).toEqual([absolute]);
  });

  it("절대 경로 패턴은 프로젝트 디렉터리 밖의 파일과도 일치한다", () => {
    // Given
    const nginx = instruction("nginx.md", ["/etc/nginx/**/*.conf"]);

    // When
    const selected = selectForFile([nginx, api], "/etc/nginx/sites/default.conf", projectDir);

    // Then
    expect(selected).toEqual([nginx]);
  });

  it("~로 시작하는 패턴은 홈 디렉터리 기준 절대 경로로 비교한다", () => {
    // Given
    const dotfiles = instruction("dotfiles.md", ["~/.config/**"]);
    const file = path.join(homedir(), ".config/foo/bar.json").split(path.sep).join("/");

    // When
    const selected = selectForFile([dotfiles], file, projectDir);

    // Then
    expect(selected).toEqual([dotfiles]);
  });

  it("상대 경로 패턴은 프로젝트 디렉터리 밖의 파일과 일치하지 않는다", () => {
    // Given
    const anyTs = instruction("any.md", ["**/*.ts"]);

    // When
    const selected = selectForFile([anyTs], "/elsewhere/a.ts", projectDir);

    // Then
    expect(selected).toEqual([]);
  });
});

// FR-3. 경로 패턴 형식에 따라 Linux와 Windows 절대 경로를 각각 지원한다
describe("selectForFile: Windows 경로", () => {
  const winProjectDir = "C:\\repo";

  it.each([
    ["C:\\Users\\me\\notes\\**\\*.md", "C:/Users/me/notes/a/todo.md"],
    ["C:/Users/me/notes/**/*.md", "C:/Users/me/notes/a/todo.md"],
    ["c:\\users\\ME\\notes\\**", "C:/Users/me/notes/todo.md"],
    ["\\\\server\\share\\docs\\**", "//server/share/docs/a.md"],
    ["//server/share/docs/**", "//server/share/docs/a.md"],
  ])("Windows 패턴 %s 는 %s 와 일치한다", (pattern, file) => {
    // Given
    const notes = instruction("notes.md", [pattern]);

    // When
    const selected = selectForFile([notes], file, winProjectDir);

    // Then
    expect(selected).toEqual([notes]);
  });

  it("Windows 절대 경로 패턴은 프로젝트 디렉터리 안의 파일과 절대 경로로 비교한다", () => {
    // Given
    const absolute = instruction("absolute.md", ["C:\\repo\\src\\api\\**\\*.ts"]);

    // When
    const selected = selectForFile([absolute], "src/api/users.ts", winProjectDir);

    // Then
    expect(selected).toEqual([absolute]);
  });

  it("~\\ 패턴은 Windows 홈 디렉터리 기준으로 비교한다", () => {
    // Given
    const dotfiles = instruction("dotfiles.md", ["~\\.config\\**"]);

    // When
    const selected = selectForFile([dotfiles], "C:/Users/me/.config/a.json", winProjectDir, "C:\\Users\\me");

    // Then
    expect(selected).toEqual([dotfiles]);
  });

  it("Linux 패턴은 Windows 파일과, Windows 패턴은 Linux 파일과 일치하지 않는다", () => {
    // Given
    const linux = instruction("linux.md", ["/Users/me/**"]);
    const windows = instruction("windows.md", ["C:/Users/me/**"]);

    // When
    const onWindows = selectForFile([linux, windows], "C:/Users/me/a.md", winProjectDir);
    const onLinux = selectForFile([linux, windows], "/Users/me/a.md", projectDir);

    // Then
    expect(onWindows).toEqual([windows]);
    expect(onLinux).toEqual([linux]);
  });

  it("Linux 패턴은 대소문자를 구분한다", () => {
    // Given
    const linux = instruction("linux.md", ["/etc/nginx/**"]);

    // When
    const selected = selectForFile([linux], "/etc/NGINX/a.conf", projectDir);

    // Then
    expect(selected).toEqual([]);
  });
});

// FR-4. 항상 적용 지침
describe("selectAlwaysApplied", () => {
  it("paths가 없는 지침만 고른다", () => {
    // Given
    const instructions = [api, always];

    // When
    const selected = selectAlwaysApplied(instructions);

    // Then
    expect(selected).toEqual([always]);
  });
});

