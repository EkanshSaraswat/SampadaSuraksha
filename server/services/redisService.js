const { redisClient, redisSubscriber } = require('../config/redis');

// ── Priority scoring ──
const PRIORITY_SCORES = {
  medical:    100,
  trapped:    80,
  shelter:    60,
  food_water: 40,
  other:      20
};

const CHANNEL  = 'rescue-needed';
const QUEUE_KEY = 'rescue_queue';

/* ──────────────────────────────────────────────────────────
 *  Pub / Sub
 * ────────────────────────────────────────────────────────── */

/**
 * Publish a rescue-needed event to the Redis Pub/Sub channel.
 * Called whenever a new report is saved to MongoDB.
 */
async function publishRescueEvent(report) {
  if (!redisClient) return; // Fail gracefully if Redis is not configured

  try {
    const payload = JSON.stringify(report);
    await redisClient.publish(CHANNEL, payload);

    // Also add to priority queue
    const baseScore = PRIORITY_SCORES[report.category] || 20;
    // Lower score means higher priority in zrange, or we can use zrevrange if higher is better.
    // Actually, earlier the load script used zrange and subtracted timestamps. 
    // Wait, let's keep lower scores = higher priority by doing:
    // Large number minus base score multiplied by some factor, plus timestamp.
    // A simpler way: since we are using zrange (ascending), we want medical (100) to have the LOWEST score.
    // So score = -baseScore * 1000000000000 + Date.now()
    const score = -(baseScore * 1000000000000) + Date.now();
    
    await redisClient.zadd(QUEUE_KEY, score, report._id.toString());

    console.log(`📡  Published rescue event & queued report  [${report._id}]`);
  } catch (error) {
    console.error('[Redis] Error publishing event:', error);
  }
}

/**
 * Subscribe to rescue-needed events.
 * Starts an always-on listener (call once at server startup).
 */
function subscribeToRescueEvents() {
  if (!redisSubscriber) {
    console.log('⚠️  Redis subscriber not available — skipping subscription');
    return;
  }

  redisSubscriber.subscribe(CHANNEL, (err) => {
    if (err) {
      console.error('❌  Failed to subscribe:', err.message);
      return;
    }
    console.log(`🔔  Subscribed to channel: ${CHANNEL}`);
  });

  redisSubscriber.on('message', (channel, message) => {
    if (channel === CHANNEL) {
      const data = JSON.parse(message);
      console.log(`🚨  [RESCUE EVENT]  Needs: ${data.needs}  |  Category: ${data.category}  |  ID: ${data._id}`);
    }
  });
}

/* ──────────────────────────────────────────────────────────
 *  Priority Queue  (Redis Sorted Set)
 * ────────────────────────────────────────────────────────── */

/**
 * Fetch the top-N highest-priority reports from the queue.
 * Lower score = higher priority (medical emergencies have subtracted timestamps).
 */
async function getTopPriorities(limit = 10) {
  if (!redisClient) return [];

  const results = await redisClient.zrange(QUEUE_KEY, 0, limit - 1, 'WITHSCORES');

  const parsed = [];
  for (let i = 0; i < results.length; i += 2) {
    parsed.push({
      reportId: results[i],
      score:    parseFloat(results[i + 1])
    });
  }
  return parsed;
}

/**
 * Remove a specific report from the priority queue (e.g. after claiming).
 */
async function removeFromQueue(reportId) {
  if (!redisClient) return false;
  const removed = await redisClient.zrem(QUEUE_KEY, reportId.toString());
  if (removed) console.log(`🗑️  Removed report from queue  [${reportId}]`);
  return !!removed;
}

/**
 * Get total count of items in the priority queue.
 */
async function getQueueSize() {
  if (!redisClient) return 0;
  return await redisClient.zcard(QUEUE_KEY);
}

module.exports = {
  publishRescueEvent,
  subscribeToRescueEvents,
  getTopPriorities,
  removeFromQueue,
  getQueueSize,
  PRIORITY_SCORES,
  QUEUE_KEY,
  CHANNEL
};
