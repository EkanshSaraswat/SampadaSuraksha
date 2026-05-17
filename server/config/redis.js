const Redis = require('ioredis');

// ── Primary client: publishing events, managing sorted sets, general commands ──
const redisClient = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);     // exponential back-off, max 2 s
  }
});

redisClient.on('connect', () => console.log('✅  Redis client connected'));
redisClient.on('error',   (err) => console.error('❌  Redis client error:', err.message));

// ── Subscriber client: dedicated connection for SUBSCRIBE / PSUBSCRIBE ──
const redisSubscriber = new Redis(process.env.REDIS_URL, {
  tls: { rejectUnauthorized: false },
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  }
});

redisSubscriber.on('connect', () => console.log('✅  Redis subscriber connected'));
redisSubscriber.on('error',   (err) => console.error('❌  Redis subscriber error:', err.message));

module.exports = { redisClient, redisSubscriber };
