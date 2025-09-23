import { readdir } from 'fs/promises';
import { extname, join } from 'path';
import { ScanConfig } from '../config';

export async function findAllDirectories(
  config: ScanConfig,
): Promise<{ directories: string[]; subs: string[]; media: string[]; directoryMap: Record<string, string[]> }> {
  const directories: Set<string> = new Set();
  const subs: string[] = [];
  const media: string[] = [];

  const directoryMap: Record<string, string[]> = {};

  async function scan(directory: string): Promise<void> {
    // Check if this directory should be excluded
    if (config.excludePaths.some((excludePath) => directory.startsWith(excludePath))) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(directory, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (
        entry.isFile() &&
        extname(entry.name).toLowerCase() === '.srt' &&
        !entry.name.includes('.ffsubsync.') &&
        !entry.name.includes('.alass.') &&
        !entry.name.includes('.autosubsync.')
      ) {
        directoryMap[directory] ??= [];
        directoryMap[directory].push(fullPath);
        directories.add(directory);
        subs.push(fullPath);
      } else if (
        entry.isFile() &&
        ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(extname(entry.name).toLowerCase())
      ) {
        media.push(fullPath);
      }
    }
  }

  // Scan all included paths
  for (const includePath of config.includePaths) {
    await scan(includePath);
  }

  return {
    directories: Array.from(directories),
    subs,
    media,
    directoryMap,
  };
}
