const redisClient = require('../config/redis');

const publishRescueEvent = async (report) => {
  if (!redisClient) return; // Fail gracefully if Redis is not configured
  
  try {
    // 1. Publish event to all listening rescue teams
    await redisClient.publish('rescue-needed', JSON.stringify(report));
    
    // 2. Add to priority queue (sorted set)
    // Score logic: medical emergencies get a much lower timestamp score (higher priority)
    const score = report.medicalEmergency ? Date.now() - 10000000000 : Date.now();
    await redisClient.zadd('rescue-priority-queue', score, report._id.toString());
    
    console.log(`[Redis] Published rescue event & queued report ${report._id}`);
  } catch (error) {
    console.error('[Redis] Error publishing event:', error);
  }
};

module.exports = {
  publishRescueEvent
};
