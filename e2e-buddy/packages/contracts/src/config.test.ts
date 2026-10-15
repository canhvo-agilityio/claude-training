import { describe, expect, it } from 'vitest';
import { ConfigSchema, DEFAULT_PORT, DEFAULT_RUNS_PER_PROJECT } from './config.js';

describe('ConfigSchema', () => {
  it('fills every default from an empty object', () => {
    expect(ConfigSchema.parse({})).toEqual({
      port: DEFAULT_PORT,
      toolPaths: {},
      allowedApkDirs: [],
      retention: { runsPerProject: DEFAULT_RUNS_PER_PROJECT },
    });
  });

  it('fills the nested retention default from an empty retention object', () => {
    expect(ConfigSchema.parse({ retention: {} }).retention.runsPerProject).toBe(
      DEFAULT_RUNS_PER_PROJECT,
    );
  });

  it('keeps provided values', () => {
    const config = ConfigSchema.parse({
      port: 5000,
      toolPaths: { adb: '/opt/android/platform-tools/adb' },
      retention: { runsPerProject: 10 },
    });
    expect(config.port).toBe(5000);
    expect(config.toolPaths.adb).toBe('/opt/android/platform-tools/adb');
    expect(config.retention.runsPerProject).toBe(10);
  });

  it.each([{ port: 0 }, { port: 70000 }, { port: '4477' }, { allowedApkDirs: [''] }])(
    'rejects %j',
    (input) => {
      expect(ConfigSchema.safeParse(input).success).toBe(false);
    },
  );
});
