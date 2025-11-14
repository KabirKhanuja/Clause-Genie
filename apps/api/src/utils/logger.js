import pino from 'pino';

// pino v8+ removed the `prettyPrint` option. For development-friendly logs
// you can install `pino-pretty` and configure a transport. To avoid a hard
// dependency and runtime crash, use a minimal default logger here. If you
// want pretty output locally, set the env var `USE_PINO_PRETTY=1` and install
// `pino-pretty`, then we can enable a transport.
let logger;
if (process.env.USE_PINO_PRETTY && process.env.NODE_ENV !== 'production') {
  try {
    const transport = pino.transport({
      target: 'pino-pretty',
      options: { colorize: true }
    });
    logger = pino({ level: process.env.LOG_LEVEL || 'info' }, transport);
  } catch (err) {
    // fallback to default pino if pino-pretty not installed
    logger = pino({ level: process.env.LOG_LEVEL || 'info' });
  }
} else {
  logger = pino({ level: process.env.LOG_LEVEL || 'info' });
}

export default logger;