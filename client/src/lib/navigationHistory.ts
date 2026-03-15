let currentPath: string | null = null;
let previousPath: string | null = null;

export function updateHistory(path: string) {
  if (path !== currentPath) {
    previousPath = currentPath;
    currentPath = path;
  }
}

export function getPreviousPath(): string | null {
  return previousPath;
}
