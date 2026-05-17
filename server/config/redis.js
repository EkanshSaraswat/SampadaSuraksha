const Redis = require('ioredis');

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  
  redisClient.on('connect', () => {
    console.log('Connected to Upstash Redis');
  });

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
  });
} else {
  console.log('No REDIS_URL found in .env, skipping Redis connection (Member 3: Set up Upstash!)');
}

module.exports = redisClient;
