import { basename, dirname, join } from 'path';
import { execPromise, getAudioStreamIndex, ProcessingResult } from './helpers';
import { existsSync } from 'fs';
import { SubsyncarrEnv } from './types/env';

export async function generateFfsubsyncSubtitles(
  srtPath: string,
  videoPath: string,
  env?: SubsyncarrEnv,
): Promise<ProcessingResult> {
  const directory = dirname(srtPath);
  const srtBaseName = basename(srtPath, '.srt');
  const outputPath = join(directory, `${srtBaseName}.ffsubsync.srt`);

  const AUDIO_TRACK_LANGUAGE = env?.AUDIO_TRACK_LANGUAGE || process.env.AUDIO_TRACK_LANGUAGE;
  const FFSUBSYNC_ARGS = env?.FFSUBSYNC_ARGS || process.env.FFSUBSYNC_ARGS;

  // Check if synced subtitle already exists
  const exists = existsSync(outputPath);
  if (exists) {
    return {
      success: true,
      message: `Skipping ${outputPath} - already processed`,
    };
  }

  try {
    let index = -1;
    if (AUDIO_TRACK_LANGUAGE) {
      index = (await getAudioStreamIndex(videoPath, AUDIO_TRACK_LANGUAGE)).relativeIndex;
    }

    let command = `ffsubsync "${videoPath}" -i "${srtPath}" -o "${outputPath}"`;
    if (index !== -1) {
      command += ` --reference-stream a:${index - 1}`;
    }

    if (FFSUBSYNC_ARGS) {
      command += ` ${FFSUBSYNC_ARGS}`;
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
