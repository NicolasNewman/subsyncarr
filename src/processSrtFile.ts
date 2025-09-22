import { basename } from 'path';
import { findMatchingVideoFile } from './findMatchingVideoFile';
import { generateAutosubsyncSubtitles } from './generateAutosubsyncSubtitles';
import { generateFfsubsyncSubtitles } from './generateFfsubsyncSubtitles';
import { generateAlassSubtitles } from './generateAlassSubtitles';
import { SubsyncarrEnv } from './types/env';
import { Engine, ProcessingResult } from './helpers';

export const processSrtFile = async (srtFile: string, env?: SubsyncarrEnv) => {
  const videoFile = findMatchingVideoFile(srtFile);
  const includeEngines = process.env.INCLUDE_ENGINES?.split(',') || ['ffsubsync', 'autosubsync', 'alass'];

  const results: {
    file: string;
    engines: Record<Engine, ProcessingResult | null>;
  } = {
    file: srtFile,
    engines: {
      ffsubsync: null,
      autosubsync: null,
      alass: null,
    },
  };

  if (videoFile) {
    if (includeEngines.includes('ffsubsync')) {
      const ffsubsyncResult = await generateFfsubsyncSubtitles(srtFile, videoFile, env);
      results.engines.ffsubsync = ffsubsyncResult;
      console.log(`${new Date().toLocaleString()} ffsubsync result: ${ffsubsyncResult.message}`);
    }
    if (includeEngines.includes('autosubsync')) {
      const autosubsyncResult = await generateAutosubsyncSubtitles(srtFile, videoFile, env);
      results.engines.autosubsync = autosubsyncResult;
      console.log(`${new Date().toLocaleString()} autosubsync result: ${autosubsyncResult.message}`);
    }
    if (includeEngines.includes('alass')) {
      const alassResult = await generateAlassSubtitles(srtFile, videoFile, env);
      results.engines.alass = alassResult;
      console.log(`${new Date().toLocaleString()} alass result: ${alassResult.message}`);
    }
  } else {
    console.log(`${new Date().toLocaleString()} No matching video file found for: ${basename(srtFile)}`);
  }

  return results;
};
