/**
 * ───────────────────────────────────────────────────────────
 *  Load Simulation Script — 100 Concurrent Reports
 *  Run:  node scripts/simulateLoad.js
 * ───────────────────────────────────────────────────────────
 *
 *  This script:
 *    1. Connects directly to Upstash Redis
 *    2. Generates 100 randomized mock reports
 *    3. Publishes all 100 rescue-needed events via pipeline
 *    4. Adds all 100 to the priority queue sorted set
 *    5. Displays the top 10 priorities to verify ordering
 */

require('dotenv').config();
const Redis = require('ioredis');

const CHANNEL   = 'rescue-needed';
const QUEUE_KEY = 'rescue_queue';

const PRIORITY_SCORES = {
  medical:    100,
  trapped:    80,
  shelter:    60,
  food_water: 40,
  other:      20
};

const CATEGORIES  = ['medical', 'trapped', 'shelter', 'food_water', 'other'];
const FIRST_NAMES = ['Aarav', 'Priya', 'Rohan', 'Sneha', 'Vikram', 'Anita', 'Karan', 'Meera', 'Arjun', 'Deepa',
                     'Rahul', 'Pooja', 'Nikhil', 'Kavya', 'Amit', 'Sonal', 'Raj', 'Neha', 'Dev', 'Anjali'];
const DESCRIPTIONS = [
  'Need immediate medical attention',
  'Trapped under debris, need rescue',
  'Family stranded on rooftop, need evacuation',
  'Running out of food and drinking water',
  'Need shelter, house completely destroyed',
  'Elderly person needs medication urgently',
  'Children stranded in flooded area',
  'Multiple injuries, need ambulance',
  'Need warm clothing and blankets',
  'Road blocked, need rescue team access'
];

// ── Helpers ──

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCoords() {
  // Random coordinates roughly within India
  const lat = 8.0 + Math.random() * 28.0;    // 8°N to 36°N
  const lng = 68.0 + Math.random() * 29.0;    // 68°E to 97°E
  return [parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))];
}

function generateMockReports(count) {
  const reports = [];
  for (let i = 0; i < count; i++) {
    const category = randomItem(CATEGORIES);
    reports.push({
      _id:        `sim_${Date.now()}_${i}`,
      victimName: randomItem(FIRST_NAMES),
      description: randomItem(DESCRIPTIONS),
      category,
      location: { type: 'Point', coordinates: randomCoords() },
      status:    'pending',
      createdAt: new Date().toISOString()
    });
  }
  return reports;
}

// ── Main ──

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🚀  SampadaSuraksha Load Simulation');
  console.log('═══════════════════════════════════════════\n');

  const redis = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false }
  });

  redis.on('error', (err) => { console.error('Redis error:', err.message); });

  // Wait for connection
  await new Promise((resolve) => redis.once('connect', resolve));
  console.log('✅  Connected to Upstash Redis\n');

  const REPORT_COUNT = 100;
  const reports = generateMockReports(REPORT_COUNT);

  // Count categories for summary
  const categoryCounts = {};
  reports.forEach(r => {
    categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  });

  console.log(`📊  Generated ${REPORT_COUNT} mock reports:`);
  Object.entries(categoryCounts)
    .sort((a, b) => PRIORITY_SCORES[b[0]] - PRIORITY_SCORES[a[0]])
    .forEach(([cat, count]) => {
      console.log(`    ${cat.padEnd(12)} → ${count} reports  (priority: ${PRIORITY_SCORES[cat]})`);
    });
  console.log('');

  // ── Phase 1: Publish all events via pipeline ──
  console.log('📡  Phase 1: Publishing rescue-needed events...');
  const startPub = Date.now();

  const pubPipeline = redis.pipeline();
  reports.forEach(report => {
    const payload = JSON.stringify({
      id:        report._id,
      victim:    report.victimName,
      category:  report.category,
      coords:    report.location.coordinates,
      status:    report.status,
      createdAt: report.createdAt
    });
    pubPipeline.publish(CHANNEL, payload);
  });

  await pubPipeline.exec();
  const pubTime = Date.now() - startPub;
  console.log(`    ✅  Published ${REPORT_COUNT} events in ${pubTime}ms\n`);

  // ── Phase 2: Add all to priority queue via pipeline ──
  console.log('📋  Phase 2: Adding to priority queue (sorted set)...');
  const startQueue = Date.now();

  const queuePipeline = redis.pipeline();
  reports.forEach((report, i) => {
    const base = PRIORITY_SCORES[report.category] || 20;
    const timeFraction = (i + 1) / 100000;   // deterministic ordering within same category
    const score = base + timeFraction;

    const member = JSON.stringify({
      id:       report._id,
      victim:   report.victimName,
      category: report.category,
      coords:   report.location.coordinates,
      status:   report.status
    });

    queuePipeline.zadd(QUEUE_KEY, score, member);
  });

  await queuePipeline.exec();
  const queueTime = Date.now() - startQueue;
  console.log(`    ✅  Queued ${REPORT_COUNT} reports in ${queueTime}ms\n`);

  // ── Phase 3: Verify — show top 10 priorities ──
  console.log('🏆  Phase 3: Top 10 Priority Reports:');
  console.log('─'.repeat(70));

  const topResults = await redis.zrevrange(QUEUE_KEY, 0, 9, 'WITHSCORES');
  for (let i = 0; i < topResults.length; i += 2) {
    const data  = JSON.parse(topResults[i]);
    const score = parseFloat(topResults[i + 1]).toFixed(5);
    const rank  = (i / 2) + 1;
    console.log(`  #${String(rank).padStart(2)}  |  Score: ${score}  |  Category: ${data.category.padEnd(12)}  |  Victim: ${data.victim}`);
  }
  console.log('─'.repeat(70));

  // ── Summary ──
  const totalSize = await redis.zcard(QUEUE_KEY);
  console.log(`\n📈  Queue total size: ${totalSize}`);
  console.log(`⏱️  Total time: ${pubTime + queueTime}ms`);
  console.log(`    Publish:  ${pubTime}ms`);
  console.log(`    Queue:    ${queueTime}ms`);

  // Verify medical emergencies are at the top
  const topCategory = JSON.parse(topResults[0]).category;
  if (topCategory === 'medical') {
    console.log('\n✅  VERIFICATION PASSED: Medical emergencies are at the top of the queue!');
  } else {
    console.log(`\n⚠️  VERIFICATION NOTE: Top category is "${topCategory}" — may be correct if no medical reports were generated.`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅  Load simulation complete!');
  console.log('═══════════════════════════════════════════\n');

  await redis.quit();
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Simulation failed:', err);
  process.exit(1);
});
