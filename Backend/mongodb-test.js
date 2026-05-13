const { MongoClient } = require('mongodb');

// Your connection string
const uri = "mongodb+srv://admin:restaurant123@cluster0.f5lcoy1.mongodb.net/?appName=Cluster0";

// Create a new MongoClient
const client = new MongoClient(uri, {
  connectTimeoutMS: 10000, // Timeout after 10 seconds
  serverSelectionTimeoutMS: 10000,
  family: 4 // Force IPv4
});

async function run() {
  console.log('🔄 Attempting to connect to MongoDB Atlas...');
  console.log('Connection string:', uri.replace('restaurant123', '********')); // Hide password
  
  try {
    // Try to connect
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // Test the connection by listing databases
    const databases = await client.db().admin().listDatabases();
    console.log('📊 Available databases:');
    databases.databases.forEach(db => console.log(`   - ${db.name}`));
    
    await client.close();
    console.log('👋 Connection closed');
    
  } catch (err) {
    console.error('❌ Connection failed!');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    
    // Specific troubleshooting based on error
    if (err.message.includes('querySrv') || err.message.includes('getaddrinfo')) {
      console.log('\n🔍 TROUBLESHOOTING STEPS:');
      console.log('1. Check your internet connection');
      console.log('2. Flush DNS: Open CMD as Admin and run: ipconfig /flushdns');
      console.log('3. Change DNS to Google: 8.8.8.8 and 8.8.4.4');
      console.log('4. Disable IPv6 in network adapter settings');
      console.log('5. Try using a mobile hotspot');
      console.log('6. Temporarily disable firewall/antivirus');
    }
    
    if (err.message.includes('Authentication')) {
      console.log('\n🔍 AUTHENTICATION ISSUE:');
      console.log('- Check if username/password is correct');
      console.log('- Password might have special characters that need encoding');
    }
  }
}

// Run the test
run();