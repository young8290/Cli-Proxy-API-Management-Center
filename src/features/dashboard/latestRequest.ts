export interface LatestRequest {
  begin: () => number;
  isLatest: (generation: number) => boolean;
  commit: <T>(generation: number, action: () => T) => T | undefined;
}

export function createLatestRequest(): LatestRequest {
  let generation = 0;
  return {
    begin: () => ++generation,
    isLatest: (candidate) => candidate === generation,
    commit: (candidate, action) => (candidate === generation ? action() : undefined),
  };
}
