import { readdir } from 'fs/promises';
import { extname, join } from 'path';
import { ScanConfig } from '../config';

export async function findAllMediaFiles(config: ScanConfig): Promise<string[]> {
  const files: string[] = [];

  async function scan(directory: string): Promise<void> {
    // Check if this directory should be excluded
    if (config.excludePaths.some((excludePath) => directory.startsWith(excludePath))) {
      return;
    }

    if (directory.match(/\.mkv$|\.mp4$|\.avi$|\.mov$|\.wmv$|\.flv$/)) {
      files.push(directory);
    } else {
      const entries = await readdir(directory, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(directory, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (
          entry.isFile() &&
          ['.mkv', '.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(extname(entry.name).toLowerCase())
        ) {
          files.push(fullPath);
        }
      }
    }
  }

  // Scan all included paths
  for (const includePath of config.includePaths) {
    await scan(includePath);
  }

  return files;
}
