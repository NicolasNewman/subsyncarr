import { basename, dirname, join } from 'path';
import { execPromise, ProcessingResult } from './helpers';
import { existsSync } from 'fs';
import { SubsyncarrEnv } from './types/env';

export async function generateAutosubsyncSubtitles(
  srtPath: string,
  videoPath: string,
  env?: SubsyncarrEnv,
): Promise<ProcessingResult> {
  const directory = dirname(srtPath);
  const srtBaseName = basename(srtPath, '.srt');
  const outputPath = join(directory, `${srtBaseName}.autosubsync.srt`);

  const AUTOSUBSYNC_ARGS = env?.AUTOSUBSYNC_ARGS || process.env.AUTOSUBSYNC_ARGS;

  const exists = existsSync(outputPath);
  if (exists) {
    return {
      success: true,
      message: `Skipping ${outputPath} - already processed`,
    };
  }

  try {
    let command = `autosubsync "${videoPath}" "${srtPath}" "${outputPath}"`;
    if (AUTOSUBSYNC_ARGS) {
      command += ` ${AUTOSUBSYNC_ARGS}`;
    }
    console.log(`${new Date().toLocaleString()} Processing: ${command}`);
    await execPromise(command);
    return {
      success: true,
      message: `Successfully processed: ${outputPath}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Error processing ${outputPath}: ${errorMessage}`,
    };
  }
}
