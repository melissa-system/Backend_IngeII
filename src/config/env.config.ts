export const EnvConfig = () => ({
  environment: process.env.NODE_ENV,
  port: process.env.PORT, // Server port
  host: process.env.DB_HOST,
  dbPort: process.env.DB_PORT,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});
