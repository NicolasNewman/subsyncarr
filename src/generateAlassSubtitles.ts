import { basename, dirname, join } from 'path';
import { execPromise, getAudioStreamIndex, ProcessingResult } from './helpers';
import { existsSync } from 'fs';

export async function generateAlassSubtitles(srtPath: string, videoPath: string): Promise<ProcessingResult> {
  const directory = dirname(srtPath);
  const srtBaseName = basename(srtPath, '.srt');
  const outputPath = join(directory, `${srtBaseName}.alass.srt`);

  const exists = existsSync(outputPath);
  if (exists) {
    return {
      success: true,
      message: `Skipping ${outputPath} - already processed`,
    };
  }

  let index = -1;
  if (process.env.AUDIO_TRACK_LANGUAGE) {
    index = (await getAudioStreamIndex(videoPath, process.env.AUDIO_TRACK_LANGUAGE)).index;
  }

  try {
    let command = `alass "${videoPath}" "${srtPath}" "${outputPath}"`;
    if (index !== -1) {
      command += ` --index ${index}`;
    }
    if (process.env.ALASS_ARGS) {
      command += ` ${process.env.ALASS_ARGS}`;
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
