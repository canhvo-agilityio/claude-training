import { z } from 'zod';

export const DEFAULT_PORT = 4477;
/** Runs kept per project before cleanup (spec §4.3). */
export const DEFAULT_RUNS_PER_PROJECT = 50;

/** Optional absolute paths that override tool discovery (spec §6). */
export const ToolPathsSchema = z.object({
  maestro: z.string().min(1).optional(),
  adb: z.string().min(1).optional(),
  java: z.string().min(1).optional(),
});

/** `~/.e2e-buddy/config.json` (spec §4). Every field has a default, so `{}` is a valid config. */
export const ConfigSchema = z.object({
  port: z.number().int().min(1).max(65535).default(DEFAULT_PORT),
  toolPaths: ToolPathsSchema.default({}),
  allowedApkDirs: z.array(z.string().min(1)).default([]),
  retention: z
    .object({
      runsPerProject: z.number().int().positive().default(DEFAULT_RUNS_PER_PROJECT),
    })
    .default({ runsPerProject: DEFAULT_RUNS_PER_PROJECT }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ToolPaths = z.infer<typeof ToolPathsSchema>;
