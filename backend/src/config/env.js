const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env explicitly
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'railway_db',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/railway_db',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'railway_db',
  JWT_SECRET: process.env.JWT_SECRET || 'default_jwt_secret',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || ''
};

module.exports = config;
