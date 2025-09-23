import express from 'express';
import bodyParser from 'body-parser';
import { getScanConfig } from '../config';
import { findAllDirectories } from './findAllDirectories';
import { findAllSrtFiles } from '../findAllSrtFiles';
import { processSrtFile } from '../processSrtFile';
import { SubsyncarrEnv } from '../types/env';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';
import SyncLock from './syncLock';
import { defaultIfEmpty, execPromise } from '../helpers';
import { findAllMediaFiles } from './findAllMediaFiles';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const port = process.env.PORT || 3000;
const maxConcurrentSyncTasks = process.env.MAX_CONCURRENT_SYNC_TASKS
  ? parseInt(process.env.MAX_CONCURRENT_SYNC_TASKS)
  : 1;

const apiKey = process.env.API_KEY;
app.use((req, res, next) => {
  if (apiKey) {
    const requestApiKey = req.headers['Authorization'];
    if (requestApiKey !== apiKey) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  next();
});

// Note: this isn't perfect but should handle most cases as long as only one person is using the API
const syncLock = new SyncLock();

/**
 * @swagger
 * /paths:
 *   get:
 *     summary: Get all directories available for scanning
 *     responses:
 *       200:
 *         description: A list of directories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 directories:
 *                   type: array
 *                   items:
 *                     type: string
 *                 subs:
 *                   type: array
 *                   items:
 *                     type: string
 *                 media:
 *                   type: array
 *                   items:
 *                     type: string
 *                 directoryMap:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 */
app.get('/paths', async (req, res) => {
  const scanConfig = getScanConfig();
  const directories = await findAllDirectories(scanConfig);
  res.json({ directories });
});

type ExecResult = {
  success: Record<string, string[]>;
  failure: Record<
    string,
    {
      engine: string;
      message: string;
      code: number | undefined;
      stderr: string | undefined;
      stdout: string | undefined;
      cmd: string | undefined;
    }[]
  >;
};
/**
 * @swagger
 * /sync:
 *   post:
 *     summary: Trigger subtitle synchronization for .srt files in the specified path
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - engine
 *               - path
 *             properties:
 *               engine:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [ffsubsync, autosubsync, alass]
 *                 example: [ffsubsync, alass]
 *               path:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["/path/to/show", "/path/to/show2/subtitle.srt"]
 *     parameters:
 *       - in: header
 *         name: AUDIO_TRACK_LANGUAGE
 *         required: false
 *         description: The language of the audio track
 *         schema:
 *           type: string
 *           example: jpn
 *       - in: header
 *         name: FFSUBSYNC_ARGS
 *         required: false
 *         description: Additional arguments for ffsubsync. See [docs](https://ffsubsync.readthedocs.io/en/latest/) for options.
 *         schema:
 *           type: string
 *           example: --gss --vad subs_then_silero --max-offset-seconds 90
 *       - in: header
 *         name: AUTOSUBSYNC_ARGS
 *         required: false
 *         description: Additional arguments for autosubsync. See [docs](https://github.com/oseiskar/autosubsync/blob/master/autosubsync/main.py) for options.
 *         schema:
 *           type: string
 *       - in: header
 *         name: ALASS_ARGS
 *         required: false
 *         description: Additional arguments for alass. See [docs](https://github.com/kaegi/alass/blob/master/alass-cli/src/main.rs) for options.
 *         schema:
 *           type: string
 *       - in: header
 *         name: OVERWRITE
 *         required: false
 *         description: Whether to overwrite existing subtitles. (e.g., 'true' or 'false')
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           example: true
 *     responses:
 *       200:
 *         description: Sync started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 success:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 *                 failure:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         engine:
 *                           type: string
 *                         message:
 *                           type: string
 *                         code:
 *                           type: integer
 *                         stderr:
 *                           type: string
 *                         stdout:
 *                           type: string
 *                         cmd:
 *                          type: string
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       409:
 *         description: Conflict - Sync already in progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post('/sync', async (req, res) => {
  if (!syncLock.tryLock()) {
    return res.status(409).json({
      error: 'Sync operation already in progress',
    });
  }

  try {
    const engineParam = req.body.engine as string[];
    const pathParam = req.body.path as string[];

    const env: SubsyncarrEnv = {
      AUDIO_TRACK_LANGUAGE: defaultIfEmpty(req.headers.audio_track_language as string | undefined),
      FFSUBSYNC_ARGS: defaultIfEmpty(req.headers.ffsubsync_args as string | undefined),
      AUTOSUBSYNC_ARGS: defaultIfEmpty(req.headers.autosubsync_args as string | undefined),
      ALASS_ARGS: defaultIfEmpty(req.headers.alass_args as string | undefined),
      OVERWRITE: defaultIfEmpty(req.headers.overwrite as string | undefined),
    };

    if (!engineParam || !pathParam) {
      syncLock.unlock();
      return res.status(400).json({ error: 'Missing engine or path parameter' });
    }

    const engines = engineParam.map((e) => e.trim().toLowerCase());
    const validEngines: string[] = ['ffsubsync', 'autosubsync', 'alass'];
    const invalidEngines = engines.filter((e) => !validEngines.includes(e));

    if (invalidEngines.length > 0) {
      syncLock.unlock();
      return res.status(400).json({ error: `Invalid engines: ${invalidEngines.join(', ')}` });
    }

    const scanConfig = getScanConfig(pathParam);
    const srtFiles = await findAllSrtFiles(scanConfig);

    const execResults: ExecResult = {
      success: {},
      failure: {},
    };
    for (let i = 0; i < srtFiles.length; i += maxConcurrentSyncTasks) {
      const chunk = srtFiles.slice(i, i + maxConcurrentSyncTasks);
      const result = (await Promise.all(chunk.map((srtFile) => processSrtFile(srtFile, env)))).reduce(
        (prev, { engines, file }) => {
          prev.success[file] = Object.entries(engines)
            .filter(([, result]) => result && result.success)
            .map(([engine]) => engine);
          prev.failure[file] = Object.entries(engines)
            .filter(([, result]) => result && !result.success)
            .map(([engine, error]) => ({
              engine,
              message: error?.message || 'Unknown Error',
              code: error?.code,
              stderr: error?.stderr,
              stdout: error?.stdout,
              cmd: error?.cmd,
            }));
          if (prev.success[file].length === 0) {
            delete prev.success[file];
          }
          if (prev.failure[file].length === 0) {
            delete prev.failure[file];
          }
          return prev;
        },
        { success: {}, failure: {} } as ExecResult,
      );

      execResults.success = { ...execResults.success, ...result.success };
      execResults.failure = { ...execResults.failure, ...result.failure };
    }

    res.json({
      message: `Sync triggered for path: ${pathParam} with engines: ${engines.join(', ')}`,
      success: execResults.success,
      failure: execResults.failure,
      env,
    });
  } catch (error) {
    console.error('Error occurred while processing sync request:', error);
    res
      .status(500)
      .json({ error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` });
  } finally {
    syncLock.unlock();
  }
});

/**
 * @swagger
 * /unlock:
 *   get:
 *     summary: Manually release the sync lock
 *     responses:
 *       200:
 *         description: Sync lock released successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 */
app.get('/unlock', (req, res) => {
  syncLock.unlock();
  res.json({ message: 'Sync lock released' });
});

/**
 * @swagger
 * /ffprobe:
 *   post:
 *     summary: Get ffprobe data for all media files in the specified paths
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - path
 *             properties:
 *               path:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["/path/to/show1", "/path/to/show2/ep01.mkv"]
 *     responses:
 *       200:
 *         description: A list of ffprobe data for each media file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 result:
 *                   type: array
 *                   items:
 *                     type: object
 */
app.post('/ffprobe', async (req, res) => {
  const pathParam = req.body.path as string[];

  const scanConfig = getScanConfig(pathParam);
  const mediaFiles = await findAllMediaFiles(scanConfig);

  try {
    const result = (
      await Promise.all(
        mediaFiles.map(async (mediaFile) =>
          execPromise(
            `ffprobe -v error -show_entries stream=index,codec_name,codec_type:stream_tags=language -of json "${mediaFile}"`,
          ),
        ),
      )
    ).map(({ stdout }) => JSON.parse(stdout));
    res.json({
      result,
    });
  } catch (error) {
    console.error('Error occurred while processing ffprobe request:', error);
    return res.status(500).json({ ...(error as Error) });
  }
});

app.listen(port, () => {
  console.log(`Subsyncarr API listening on port ${port}`);
});
