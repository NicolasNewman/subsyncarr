export interface SubsyncarrEnv {
  AUDIO_TRACK_LANGUAGE?: string; // e.g., 'eng'
  FFSUBSYNC_ARGS?: string; // Additional arguments for ffsubsync
  AUTOSUBSYNC_ARGS?: string; // Additional arguments for autosubsync
  ALASS_ARGS?: string; // Additional arguments for alass
}

declare namespace NodeJS {
  interface ProcessEnv extends SubsyncarrEnv {}
}
