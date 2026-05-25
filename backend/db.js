require("dotenv").config();
const sql = require("mssql");

console.log("DB_USER =", process.env.DB_USER);
console.log("DB_PASSWORD =", process.env.DB_PASSWORD);

const config = {
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT, 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === "true",
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === "true",
  },
};

async function connectDB() {
  const pool = await sql.connect(config);
  console.log("SQL connected");
  return pool;
}

module.exports = { sql, connectDB };