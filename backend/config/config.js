export const config = {
  // Server Configuration
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || "development",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",

  // Database
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/cms-mini",

  // JWT Configuration
  JWT_SECRET:
    process.env.JWT_SECRET ||
    "your-super-secret-jwt-key-change-this-in-production",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
  UPLOAD_PATH: process.env.UPLOAD_PATH || "./uploads",

  // Admin User (for initial setup)
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@cms-mini.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "admin123",
};
