const mongoose = require('mongoose');
const User = require('./models/User');
const connectDB = require('./config/db');
require('dotenv').config({ path: './.env' });
const axios = require('axios');
const generateToken = require('./utils/generateToken');

async function test() {
  await connectDB();
  let team = await User.findOne({ role: 'RescueTeam' });
  if (!team) {
    team = await User.create({ name: 'Test Team', email: 'team@test.com', password: 'password', role: 'RescueTeam', approvalStatus: 'approved' });
  } else {
    team.approvalStatus = 'approved';
    await team.save();
  }
  
  const token = generateToken(team);
  console.log('Token:', token);
  
  const headers = { headers: { Authorization: `Bearer ${token}` } };
  console.log('Fetching /api/auth/me...');
  await axios.get('http://localhost:5001/api/auth/me', headers).then(r=>console.log('me OK')).catch(e=>console.log('me FAIL', e.message));
  
  console.log('Fetching /api/reports/pending...');
  await axios.get('http://localhost:5001/api/reports/pending', headers).then(r=>console.log('pending OK')).catch(e=>console.log('pending FAIL', e.message));
  
  console.log('Fetching /api/resources/allocations/received...');
  await axios.get('http://localhost:5001/api/resources/allocations/received', headers).then(r=>console.log('alloc OK')).catch(e=>console.log('alloc FAIL', e.message));
  
  console.log('Fetching /api/reports/priority...');
  await axios.get('http://localhost:5001/api/reports/priority', headers).then(r=>console.log('priority OK')).catch(e=>console.log('priority FAIL', e.message));
  
  process.exit(0);
}
test();
