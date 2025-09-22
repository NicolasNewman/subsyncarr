import { promisify } from 'util';
import { exec } from 'child_process';

export interface ProcessingResult {
  success: boolean;
  message: string;
}

export const execPromise = promisify(exec);

export type FFProbeStream = {
  index: number;
  codec_type: string;
  codec_name: string;
  tags: {
    language: string;
  };
};

export const getAudioStreamIndex = async (
  videoPath: string,
  language: string,
): Promise<{
  index: number;
  relativeIndex: number;
}> => {
  try {
    const command = `ffprobe -v error -show_entries stream=index,codec_type:stream_tags=language -select_streams a -of json "${videoPath}"`;
    const result = await execPromise(command);
    const streams = JSON.parse(result.stdout).streams;

    let i = 0;
    const audioStream = streams.find((s: FFProbeStream) => {
      i++;
      return s.codec_type === 'audio' && s.tags.language === language;
    });
    return audioStream
      ? {
          index: audioStream.index,
          relativeIndex: i - 1,
        }
      : {
          index: -1,
          relativeIndex: -1,
        };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Error getting audio stream index for ${videoPath}: ${errorMessage}`);
  }
};

export const getSubtitleStreamIndex = async (
  videoPath: string,
  language: string,
): Promise<{
  type: string;
  index: number;
}> => {
  try {
    const command = `ffprobe -v error -show_entries stream=index,codec_name,codec_type:stream_tags=language,codec_name -select_streams s -of json "${videoPath}"`;
    const result = await execPromise(command);
    const streams = JSON.parse(result.stdout).streams as FFProbeStream[];
    if (streams.length > 0) {
      let i = 0;
      const subtitleStream = streams.find((s: FFProbeStream) => {
        i++;
        return s.codec_type === 'subtitle' && s.tags.language === language;
      });
      return subtitleStream
        ? {
            type: subtitleStream.codec_name,
            index: i - 1,
          }
        : {
            type: streams[0].codec_name,
            index: 0,
          };
    }
    throw new Error(`Error getting subtitle stream index for ${videoPath}: no subtitle streams found`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Error getting subtitle stream index for ${videoPath}: ${errorMessage}`);
  }
};
