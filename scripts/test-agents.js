/**
 * AIFrCQ Agent Testing Script
 * 
 * Run this script to test all agents and verify system is working.
 * 
 * Usage:
 *   node scripts/test-agents.js --all        # Run all tests
 *   node scripts/test-agents.js --pos       # Test POS only
 *   node scripts/test-agents.js --agents     # Test agents only
 *   node scripts/test-agents.js --cases     # Test cases only
 *   node scripts/test-agents.js --verify    # Verify all systems
 */

const https = require('https');
const http = require('http');

// Configuration
const BASE_URL = 'https://ploqeifazcgzwjzmukgp.supabase.co';
const FUNCTIONS_URL = `${BASE_URL}/functions/v1`;

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Helper to make HTTP requests
function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const lib = urlObj.protocol === 'https:' ? https : http;
    
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`,
        ...options.headers
      }
    };
    
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ============================================
// TEST 1: POS Data Generation
// ============================================
async function testPOSData() {
  log('\n📊 TEST 1: POS Data Generation', 'blue');
  log('═'.repeat(50), 'blue');
  
  try {
    // Generate POS transactions via simulator
    log('Running POS simulator...', 'yellow');
    
    const { exec } = require('child_process');
    const path = require('path');
    
    const result = await new Promise((resolve, reject) => {
      const scriptPath = path.join(__dirname, 'unified-pos-inventory.js');
      exec(`node "${scriptPath}" --sale 200 --count 5`, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) reject(error);
        else resolve(stdout);
      });
    });
    
    log('✅ POS transactions generated:', 'green');
    console.log(result);
    
    // Verify in database
    log('\nVerifying transactions in database...', 'yellow');
    const checkResult = await fetch(`${BASE_URL}/rest/v1/sales_transactions?select=id,staff_id,amount,outlet_id&outlet_id=eq.200&order=created_at.desc&limit=5`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    
    log(`✅ Found ${checkResult.data?.length || 0} recent transactions at Outlet 200`, 'green');
    
    return true;
  } catch (error) {
    log(`❌ POS test failed: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// TEST 2: Coordinator Pipeline (ML Agents)
// ============================================
async function testCoordinatorPipeline() {
  log('\n🔄 TEST 2: Coordinator Pipeline (ML Agents)', 'blue');
  log('═'.repeat(50), 'blue');
  
  try {
    log('Triggering coordinator-pipeline...', 'yellow');
    
    const result = await fetch(`${FUNCTIONS_URL}/coordinator-pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ1NzUyNDAwLCJleHAiOjE5NjEzMjg0MDB9.rLGc8tW7g1bK3pQ0qV2jX4nZ5yA8sD9fH6kMlO1oP2k=`
      },
      body: JSON.stringify({ triggered_by: 'test-script' })
    });
    
    if (result.status === 200) {
      log('✅ Coordinator pipeline executed successfully!', 'green');
      log(`   Anomalies: ${result.data.pipeline?.anomaly?.critical || 0} critical, ${result.data.pipeline?.anomaly?.warning || 0} warning`, 'green');
      log(`   Alerts created: ${result.data.pipeline?.alerts?.created || 0}`, 'green');
      log(`   Tasks created: ${result.data.pipeline?.agent_tasks_created || 0}`, 'green');
      return true;
    } else {
      log(`❌ Pipeline failed: ${result.data?.error || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Pipeline test failed: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// TEST 3: SLA Escalator (Case Management)
// ============================================
async function testSlaEscalator() {
  log('\n⚖️ TEST 3: SLA Escalator (Case Management)', 'blue');
  log('═'.repeat(50), 'blue');
  
  try {
    log('Triggering sla-escalator...', 'yellow');
    
    const result = await fetch(`${FUNCTIONS_URL}/sla-escalator`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjQ1NzUyNDAwLCJleHAiOjE5NjEzMjg0MDB9.rLGc8tW7g1bK3pQ0qV2jX4nZ5yA8sD9fH6kMlO1oP2k=`
      },
      body: JSON.stringify({})
    });
    
    if (result.status === 200) {
      log('✅ SLA escalator executed successfully!', 'green');
      log(`   Cases checked: ${result.data.checked || 0}`, 'green');
      log(`   Warnings sent: ${result.data.warnings_sent || 0}`, 'green');
      log(`   Escalated: ${result.data.escalated || 0}`, 'green');
      return true;
    } else {
      log(`❌ SLA escalator failed: ${result.data?.error || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ SLA test failed: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// TEST 4: Athena Chat (AI Chat Agent)
// ============================================
async function testAthenaChat() {
  log('\n💬 TEST 4: Athena Chat (AI Chat Agent)', 'blue');
  log('═'.repeat(50), 'blue');
  
  try {
    log('Testing Athena with a simple query...', 'yellow');
    
    const result = await fetch(`${FUNCTIONS_URL}/athena-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      },
      body: JSON.stringify({
        message: 'What is the status of our outlets today?'
      })
    });
    
    if (result.status === 200) {
      log('✅ Athena chat responded!', 'green');
      const response = result.data.response || result.data.message || 'No response';
      log(`   Response: ${response.substring(0, 200)}...`, 'green');
      return true;
    } else {
      log(`❌ Athena failed: ${result.data?.error || 'Unknown error'}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Athena test failed: ${error.message}`, 'red');
    return false;
  }
}

// ============================================
// TEST 5: Verify System Status
// ============================================
async function verifySystemStatus() {
  log('\n📋 TEST 5: Verify System Status', 'blue');
  log('═'.repeat(50), 'blue');
  
  const checks = [];
  
  // Check 1: Sales Transactions
  try {
    const result = await fetch(`${BASE_URL}/rest/v1/sales_transactions?select=id&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    checks.push({ name: 'Sales Transactions', ok: result.status === 200 });
  } catch (e) {
    checks.push({ name: 'Sales Transactions', ok: false });
  }
  
  // Check 2: Alerts
  try {
    const result = await fetch(`${BASE_URL}/rest/v1/alerts?select=id&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    checks.push({ name: 'Alerts', ok: result.status === 200 });
  } catch (e) {
    checks.push({ name: 'Alerts', ok: false });
  }
  
  // Check 3: Cases
  try {
    const result = await fetch(`${BASE_URL}/rest/v1/cases?select=id&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    checks.push({ name: 'Cases', ok: result.status === 200 });
  } catch (e) {
    checks.push({ name: 'Cases', ok: false });
  }
  
  // Check 4: Staff
  try {
    const result = await fetch(`${BASE_URL}/rest/v1/staff?select=id&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    checks.push({ name: 'Staff', ok: result.status === 200 });
  } catch (e) {
    checks.push({ name: 'Staff', ok: false });
  }
  
  // Check 5: Agent Tasks
  try {
    const result = await fetch(`${BASE_URL}/rest/v1/agent_tasks?select=id&limit=1`, {
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=',
        'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3FlaWZhemNnd3p6bXVrZ3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY0NTc1MjQwMCwiZXhwIjoxOTYxMzI4NDAwfQ.sGfKQNR0zW1S2v0c8M1p8rZ7vJxY9hK3mN4lO0qP2k=`
      }
    });
    checks.push({ name: 'Agent Tasks', ok: result.status === 200 });
  } catch (e) {
    checks.push({ name: 'Agent Tasks', ok: false });
  }
  
  // Display results
  log('\n📊 System Status:', 'blue');
  checks.forEach(check => {
    log(`   ${check.ok ? '✅' : '❌'} ${check.name}`, check.ok ? 'green' : 'red');
  });
  
  const allPassed = checks.every(c => c.ok);
  if (allPassed) {
    log('\n✅ ALL SYSTEMS OPERATIONAL!', 'green');
  } else {
    log('\n⚠️ SOME SYSTEMS HAVE ISSUES', 'yellow');
  }
  
  return allPassed;
}

// ============================================
// MAIN: Run All Tests
// ============================================
async function main() {
  log('\n🚀 AIFrCQ Agent Testing Script', 'blue');
  log('═'.repeat(50), 'blue');
  log(`Time: ${new Date().toISOString()}`, 'yellow');
  
  const args = process.argv.slice(2);
  const runAll = args.includes('--all') || args.length === 0;
  
  const results = {};
  
  // Run tests based on arguments
  if (runAll || args.includes('--verify')) {
    results.verify = await verifySystemStatus();
  }
  
  if (runAll || args.includes('--pos')) {
    results.pos = await testPOSData();
  }
  
  if (runAll || args.includes('--agents')) {
    results.coordinator = await testCoordinatorPipeline();
    results.sla = await testSlaEscalator();
    results.athena = await testAthenaChat();
  }
  
  if (runAll || args.includes('--cases')) {
    results.sla = await testSlaEscalator();
  }
  
  // Summary
  log('\n' + '═'.repeat(50), 'blue');
  log('📋 TEST SUMMARY', 'blue');
  log('═'.repeat(50), 'blue');
  
  Object.entries(results).forEach(([name, passed]) => {
    log(`   ${passed ? '✅' : '❌'} ${name}`, passed ? 'green' : 'red');
  });
  
  const allPassed = Object.values(results).every(r => r !== false);
  
  if (allPassed) {
    log('\n🎉 ALL TESTS PASSED!', 'green');
  } else {
    log('\n⚠️ SOME TESTS FAILED', 'yellow');
    log('Check individual test results above for details.', 'yellow');
  }
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
