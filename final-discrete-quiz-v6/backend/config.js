// backend/config.js
require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  FRONTEND_DIR: require('path').join(__dirname, '..', 'frontend'),
  DATA_DIR: require('path').join(__dirname, 'data'),
};
