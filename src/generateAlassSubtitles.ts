import { basename, dirname, join } from 'path';
import { execPromise, getAudioStreamIndex, isExecException, ProcessingResult } from './helpers';
import { existsSync } from 'fs';
import { SubsyncarrEnv } from './types/env';

export async function generateAlassSubtitles(
  srtPath: string,
  videoPath: string,
  env?: SubsyncarrEnv,
): Promise<ProcessingResult> {
  const directory = dirname(srtPath);
  const srtBaseName = basename(srtPath, '.srt');
  const outputPath = join(directory, `${srtBaseName}.alass.srt`);

  const AUDIO_TRACK_LANGUAGE = env?.AUDIO_TRACK_LANGUAGE || process.env.AUDIO_TRACK_LANGUAGE;
  const ALASS_ARGS = env?.ALASS_ARGS || process.env.ALASS_ARGS;

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
      index = (await getAudioStreamIndex(videoPath, AUDIO_TRACK_LANGUAGE)).index;
    }

    let command = `alass "${videoPath}" "${srtPath}" "${outputPath}"`;
    if (index !== -1) {
      command += ` --index ${index}`;
    }

    if (ALASS_ARGS) {
      command += ` ${ALASS_ARGS}`;
    }

    console.log(`${new Date().toLocaleString()} Processing: ${command}`);
    await execPromise(command);
    return {
      success: true,
      message: `Successfully processed: ${outputPath}`,
    };
  } catch (error) {
    if (isExecException(error)) {
      return {
        success: false,
        ...error,
      };
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Error processing ${outputPath}: ${errorMessage}`,
    };
  }
}
