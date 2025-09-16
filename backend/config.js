// backend/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3222,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  FRONTEND_DIR: require('path').join(__dirname, '..', 'frontend'),
  DATA_DIR: require('path').join(__dirname, 'data'),
  MONGODB_URI: process.env.MONGODB_URI || "",
};