import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || ''
  },
  uploadDir: process.env.UPLOAD_DIR || './src/uploads',
  maxUploadMB: Number(process.env.MAX_UPLOAD_MB || 50),
  keepUploads: process.env.KEEP_UPLOADS === 'true' || false
};

// Parsed data TTL in second which is set for 24 hours 
export const parsedTtlSeconds = Number(process.env.PARSED_TTL_SECONDS || 24 * 3600);