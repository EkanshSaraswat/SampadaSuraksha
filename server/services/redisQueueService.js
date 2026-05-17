const { redisClient, redisSubscriber } = require('../config/redis');

// ── Priority scoring map ──
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
  const payload = JSON.stringify({
    id:        report._id,
    victim:    report.victimName,
    category:  report.category,
    coords:    report.location.coordinates,
    status:    report.status,
    createdAt: report.createdAt
  });

  await redisClient.publish(CHANNEL, payload);
  console.log(`📡  Published rescue event  →  ${report.category}  [${report._id}]`);
}

/**
 * Subscribe to rescue-needed events.
 * Starts an always-on listener (call once at server startup).
 */
function subscribeToRescueEvents() {
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
      console.log(`🚨  [RESCUE EVENT]  Category: ${data.category}  |  Victim: ${data.victim}  |  ID: ${data.id}`);
    }
  });
}

/* ──────────────────────────────────────────────────────────
 *  Priority Queue  (Redis Sorted Set)
 * ────────────────────────────────────────────────────────── */

/**
 * Add a report to the priority queue.
 * Score = base priority + fractional timestamp component so newer
 * reports within the same category rank slightly higher.
 */
async function addToPriorityQueue(report) {
  const base      = PRIORITY_SCORES[report.category] || 20;
  // Fractional component: more recent → higher (max ~0.99)
  const timeFraction = (Date.now() % 100000) / 100000;
  const score     = base + timeFraction;

  const member = JSON.stringify({
    id:        report._id,
    victim:    report.victimName,
    category:  report.category,
    coords:    report.location.coordinates,
    status:    report.status
  });

  await redisClient.zadd(QUEUE_KEY, score, member);
  console.log(`📋  Queued report  →  score ${score.toFixed(4)}  [${report._id}]`);
}

/**
 * Fetch the top-N highest-priority reports from the queue.
 * Returns an array of { member, score } objects.
 */
async function getTopPriorities(limit = 10) {
  const results = await redisClient.zrevrange(QUEUE_KEY, 0, limit - 1, 'WITHSCORES');

  // results come as [member, score, member, score, …]
  const parsed = [];
  for (let i = 0; i < results.length; i += 2) {
    parsed.push({
      report: JSON.parse(results[i]),
      score:  parseFloat(results[i + 1])
    });
  }
  return parsed;
}

/**
 * Remove a specific report from the priority queue (e.g. after claiming).
 */
async function removeFromQueue(reportId) {
  // We need to find the member by scanning — sorted set members are stringified JSON
  const all = await redisClient.zrange(QUEUE_KEY, 0, -1);
  for (const member of all) {
    const data = JSON.parse(member);
    if (String(data.id) === String(reportId)) {
      await redisClient.zrem(QUEUE_KEY, member);
      console.log(`🗑️  Removed report from queue  [${reportId}]`);
      return true;
    }
  }
  return false;
}

/**
 * Get total count of items in the priority queue.
 */
async function getQueueSize() {
  return await redisClient.zcard(QUEUE_KEY);
}

module.exports = {
  publishRescueEvent,
  subscribeToRescueEvents,
  addToPriorityQueue,
  getTopPriorities,
  removeFromQueue,
  getQueueSize,
  PRIORITY_SCORES,
  QUEUE_KEY,
  CHANNEL
};
