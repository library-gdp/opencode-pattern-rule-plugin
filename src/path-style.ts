import path from "node:path";

/** Windows 절대 경로: 드라이브 문자(`C:\`, `C:/`) 또는 UNC(`\\server\share`, `//server/share`) */
const WINDOWS_ABSOLUTE = /^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/])/;

export function isWindowsAbsolute(file: string): boolean {
  return WINDOWS_ABSOLUTE.test(file);
}

/** Windows 또는 Linux(POSIX) 형식의 절대 경로인지 확인합니다. 실행 중인 OS와 관계없이 경로 형식으로 판단합니다. */
export function isAbsoluteAnyStyle(file: string): boolean {
  return isWindowsAbsolute(file) || file.startsWith("/");
}

/** 기준 디렉터리의 형식에 맞는 path 구현(Windows면 `path.win32`, 아니면 `path.posix`)을 돌려줍니다. */
export function pathApiFor(dir: string): path.PlatformPath {
  return isWindowsAbsolute(dir) ? path.win32 : path.posix;
}

/** 구분자를 `/`로 바꿉니다. */
export function toSlash(file: string): string {
  return file.replaceAll("\\", "/");
}
