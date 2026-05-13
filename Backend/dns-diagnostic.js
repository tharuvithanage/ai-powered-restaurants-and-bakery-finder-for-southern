const dns = require('dns');
const { promisify } = require('util');
const https = require('https');

const resolve4 = promisify(dns.resolve4);
const resolveSrv = promisify(dns.resolveSrv);
const resolveTxt = promisify(dns.resolveTxt);

async function runDiagnostic() {
  console.log('🔍 MONGODB ATLAS DNS DIAGNOSTIC\n');
  
  const hostname = 'cluster0.f5lcoy1.mongodb.net';
  const srvHost = '_mongodb._tcp.' + hostname;
  
  // Test 1: Basic DNS resolution
  console.log('1. Testing basic DNS resolution...');
  try {
    const ips = await resolve4(hostname);
    console.log(`   ✅ ${hostname} resolves to:`, ips);
  } catch (err) {
    console.log(`   ❌ Basic DNS failed:`, err.message);
    console.log('   This suggests a general DNS issue with your network');
  }
  
  // Test 2: SRV record lookup (critical for mongodb+srv)
  console.log('\n2. Testing MongoDB SRV record...');
  try {
    const records = await resolveSrv(srvHost);
    console.log(`   ✅ SRV records found:`);
    records.forEach(r => console.log(`      ${r.name}:${r.port}`));
  } catch (err) {
    console.log(`   ❌ SRV lookup failed:`, err.message);
    console.log('   This is the specific error preventing MongoDB connection');
  }
  
  // Test 3: Try with Google DNS
  console.log('\n3. Testing with Google DNS (8.8.8.8)...');
  dns.setServers(['8.8.8.8']);
  try {
    const ips = await resolve4(hostname);
    console.log(`   ✅ Using Google DNS - resolves to:`, ips);
  } catch (err) {
    console.log(`   ❌ Even Google DNS fails:`, err.message);
  } finally {
    // Reset DNS servers
    dns.setServers(['8.8.4.4', '8.8.8.8']);
  }
  
  // Test 4: HTTP check (can you reach Atlas at all?)
  console.log('\n4. Testing HTTPS reachability...');
  const req = https.get(`https://${hostname}`, (res) => {
    console.log(`   ✅ HTTPS Status:`, res.statusCode);
    console.log('   This suggests network connectivity is fine');
  });
  
  req.on('error', (err) => {
    console.log(`   ❌ HTTPS failed:`, err.message);
  });
  
  req.setTimeout(5000, () => {
    req.destroy();
    console.log(`   ❌ HTTPS timeout after 5 seconds`);
  });
}

runDiagnostic();