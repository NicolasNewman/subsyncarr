import express from 'express';
import bodyParser from 'body-parser';
import { getScanConfig } from '../config';
import { findAllDirectories } from './findAllDirectories';
import { findAllSrtFiles } from '../findAllSrtFiles';
import { processSrtFile } from '../processSrtFile';
import { SubsyncarrEnv } from '../types/env';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;
const maxConcurrentSyncTasks = process.env.MAX_CONCURRENT_SYNC_TASKS
  ? parseInt(process.env.MAX_CONCURRENT_SYNC_TASKS)
  : 1;
// const express = require('express');
// const app = express();
// const port = 3000;

/**
 * /sync?engine=ffsubsync,autosubsync&path=/some/path
 * GET /paths
 * POST /sync?engine=ffsubsync,autosubsync&path=/some/path
 * Headers:
 *   AUDIO_TRACK_LANGUAGE: en
 *   FFSUBSYNC_ARGS: --arg1 --arg2
 *   AUTOSUBSYNC_ARGS: --arg1 --arg2
 *   ALASS_ARGS: --arg1 --arg2
 * Body:
 *   engine: ffsubsync,autosubsync
 *   path: /some/path,/some/path2/sub.srt
 */

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /paths:
 *   get:
 *     summary: Get all directories to scan for .srt files
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
 */
app.get('/paths', async (req, res) => {
  const scanConfig = getScanConfig();
  const directories = await findAllDirectories(scanConfig);
  res.json({ directories });
});

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
 *                 example: ["/path/to/movie", "/path/to/subtitle.srt"]
 *     parameters:
 *       - in: header
 *         name: AUDIO_TRACK_LANGUAGE
 *         required: false
 *         description: The language of the audio track
 *         schema:
 *           type: string
 *       - in: header
 *         name: FFSUBSYNC_ARGS
 *         required: false
 *         description: Additional arguments for ffsubsync
 *         schema:
 *           type: string
 *       - in: header
 *         name: AUTOSUBSYNC_ARGS
 *         required: false
 *         description: Additional arguments for autosubsync
 *         schema:
 *           type: string
 *       - in: header
 *         name: ALASS_ARGS
 *         required: false
 *         description: Additional arguments for alass
 *         schema:
 *           type: string
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
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
app.post('/sync', async (req, res) => {
  const engineParam = req.body.engine as string[];
  const pathParam = req.body.path as string[];

  const env: SubsyncarrEnv = {
    AUDIO_TRACK_LANGUAGE: req.headers.AUDIO_TRACK_LANGUAGE as string | undefined,
    FFSUBSYNC_ARGS: req.headers.FFSUBSYNC_ARGS as string | undefined,
    AUTOSUBSYNC_ARGS: req.headers.AUTOSUBSYNC_ARGS as string | undefined,
    ALASS_ARGS: req.headers.ALASS_ARGS as string | undefined,
  };

  if (!engineParam || !pathParam) {
    return res.status(400).json({ error: 'Missing engine or path parameter' });
  }

  const engines = engineParam.map((e) => e.trim().toLowerCase());
  const validEngines = ['ffsubsync', 'autosubsync', 'alass'];
  const invalidEngines = engines.filter((e) => !validEngines.includes(e));

  if (invalidEngines.length > 0) {
    return res.status(400).json({ error: `Invalid engines: ${invalidEngines.join(', ')}` });
  }

  const scanConfig = getScanConfig(pathParam);
  console.log(scanConfig);
  const srtFiles = await findAllSrtFiles(scanConfig);
  console.log(srtFiles);

  for (let i = 0; i < srtFiles.length; i += maxConcurrentSyncTasks) {
    const chunk = srtFiles.slice(i, i + maxConcurrentSyncTasks);
    await Promise.all(chunk.map((srtFile) => processSrtFile(srtFile, env)));
  }

  res.json({ message: `Sync triggered for path: ${pathParam} with engines: ${engines.join(', ')}` });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
