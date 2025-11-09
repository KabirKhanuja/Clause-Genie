import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import config from './config/index.js';
import logger from './utils/logger.js';
import apiRoutes from './routes/api.js';
import errorHandler from './middleware/error.middleware.js';
import { connectRedis } from './utils/redisClient.js';

// bootstrap
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// static public 
app.use('/public', express.static(path.resolve('./public')));

// routes
app.use('/api', apiRoutes);

// error handler
app.use(errorHandler);

const start = async () => {
  try {
    await connectRedis();

    app.listen(config.port, () => {
      logger.info(`API started — env=${config.nodeEnv} port=${config.port}`);
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
  }
};

start();