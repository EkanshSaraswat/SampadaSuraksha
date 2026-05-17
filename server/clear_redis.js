require('dotenv').config();
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL, { tls: { rejectUnauthorized: false } });
redis.del('rescue_queue').then(() => {
  console.log('Cleared Redis rescue_queue');
  process.exit(0);
});
