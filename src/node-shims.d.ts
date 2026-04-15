declare module 'node:crypto' {
  export function createHash(algorithm: string): {
    update(data: string): { digest(encoding: string): string }
  }
}

declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: string): Promise<string>
  export function writeFile(path: string, data: string): Promise<void>
}

declare module 'node:path' {
  const path: {
    resolve(...paths: string[]): string
  }

  export default path
}
