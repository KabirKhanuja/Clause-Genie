import { createClient } from 'redis';
import config from '../config/index.js';
import logger from './logger.js';

const client = createClient({
  socket: {
    host: config.redis.host,
    port: config.redis.port
  },
  password: config.redis.password || undefined
});

client.on('error', (err) => logger.error({ err }, 'Redis client error'));
client.on('connect', () => logger.info('Connected to Redis'));

export const connectRedis = async () => {
  if (!client.isOpen) await client.connect();
  return client;
};

export default client;