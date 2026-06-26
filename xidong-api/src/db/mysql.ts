/**
 * MySQL 连接池
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'xidong',
  password: process.env.MYSQL_PASSWORD || 'xidong_dev',
  database: process.env.MYSQL_DATABASE || 'xidong_elderly',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00',
  charset: 'utf8mb4',
});

export default pool;
