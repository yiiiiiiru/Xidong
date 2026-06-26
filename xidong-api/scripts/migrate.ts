/**
 * 数据库迁移脚本
 * 读取 migrations/ 下的 SQL 文件并执行
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'xidong',
    password: process.env.MYSQL_PASSWORD || 'xidong_dev',
    database: process.env.MYSQL_DATABASE || 'xidong_elderly',
    multipleStatements: true,
    charset: 'utf8mb4',
  });

  console.log('📦 开始执行数据库迁移...');

  const sqlPath = join(__dirname, '..', 'migrations', '001_mvp.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  try {
    await connection.query(sql);
    console.log('✅ 迁移完成！10 张表已创建。');

    // 验证
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 当前表：');
    for (const row of tables as Array<Record<string, string>>) {
      console.log(`   - ${Object.values(row)[0]}`);
    }
  } catch (err) {
    console.error('❌ 迁移失败：', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
