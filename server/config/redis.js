const Redis = require('ioredis');

// ── Primary client: publishing events, managing sorted sets, general commands ──
let redisClient = null;
let redisSubscriber = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);     // exponential back-off, max 2 s
    }
  });

  redisClient.on('connect', () => console.log('✅  Redis client connected'));
  redisClient.on('error',   (err) => console.error('❌  Redis client error:', err.message));

  // ── Subscriber client: dedicated connection for SUBSCRIBE / PSUBSCRIBE ──
  redisSubscriber = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false },
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    }
  });

  redisSubscriber.on('connect', () => console.log('✅  Redis subscriber connected'));
  redisSubscriber.on('error',   (err) => console.error('❌  Redis subscriber error:', err.message));
} else {
  console.log('⚠️  No REDIS_URL found — Redis features will be disabled');
}

module.exports = { redisClient, redisSubscriber };
