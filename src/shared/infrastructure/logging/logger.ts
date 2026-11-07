import type { LogLevel } from '../../../config/env-schema';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  silent: 100
};

export type LogFieldValue = string | number | boolean | readonly string[] | readonly [string, string][] | undefined;
export type LogFields = Readonly<Record<string, LogFieldValue>>;

export interface Logger {
  readonly level: LogLevel;
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Menambah field yang ikut tercetak pada setiap log turunan (mis. requestId). */
  child(context: LogFields): Logger;
}

export type LogSink = (line: string, level: Exclude<LogLevel, 'silent'>) => void;

/** Default sink: JSON per baris ke stdout, dan ke stderr untuk warn/error. */
const consoleSink: LogSink = (line, level) => {
  const destination = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
  destination.write(`${line}\n`);
};

function writeJson(
  sink: LogSink,
  minWeight: number,
  level: Exclude<LogLevel, 'silent'>,
  context: LogFields,
  message: string,
  fields?: LogFields
): void {
  if (LEVEL_WEIGHT[level] < minWeight) {
    return;
  }

  sink(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...Object.fromEntries(Object.entries(context).filter(([, value]) => value !== undefined)),
      ...(fields ? Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) : {})
    }),
    level
  );
}

export function createLogger(level: LogLevel, sink: LogSink = consoleSink, context: LogFields = {}): Logger {
  const minWeight = LEVEL_WEIGHT[level];

  return {
    level,
    debug: (message, fields) => writeJson(sink, minWeight, 'debug', context, message, fields),
    info: (message, fields) => writeJson(sink, minWeight, 'info', context, message, fields),
    warn: (message, fields) => writeJson(sink, minWeight, 'warn', context, message, fields),
    error: (message, fields) => writeJson(sink, minWeight, 'error', context, message, fields),
    child: (extraContext) => createLogger(level, sink, { ...context, ...extraContext })
  };
}
