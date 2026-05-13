require('dotenv').config({ path: './.env' });
console.log('Test loading .env from current directory:');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'Found ✅' : 'Not found ❌');
console.log('MONGO_URI value:', process.env.MONGO_URI);
console.log('PORT:', process.env.PORT);