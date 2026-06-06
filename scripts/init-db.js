/**
 * 数据库初始化脚本
 * 在命令行运行: node scripts/init-db.js
 */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Supabase 连接配置
const CONFIG = {
  host: 'db.pnqfvfhqekgroliztnuo.supabase.co',
  port: 6543,
  database: 'postgres',
  user: 'postgres',
  password: 'lipugang461023',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
};

const sqlPath = path.join(__dirname, 'init-db.sql');

async function main() {
  console.log('🚀 开始初始化数据库...\n');

  // 检查 SQL 文件
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ 找不到 scripts/init-db.sql，请确认文件存在');
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📄 读取到 ${statements.length} 条 SQL 语句\n`);

  const client = new Client(CONFIG);

  try {
    console.log('🔗 正在连接数据库...');
    await client.connect();
    console.log('✅ 连接成功！\n');

    let ok = 0, skip = 0, err = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      const preview = stmt.replace(/\n/g, ' ').slice(0, 60);
      try {
        await client.query(stmt);
        ok++;
        console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`);
      } catch (e) {
        // 表已存在、约束冲突等可以忽略
        if (e.code === '42P07' || e.code === '23505' || e.code === '42710') {
          skip++;
          console.log(`  ⏭️  [${i + 1}/${statements.length}] 跳过(已存在): ${preview.slice(0, 40)}...`);
        } else {
          err++;
          console.log(`  ❌ [${i + 1}/${statements.length}] ${preview}...`);
          console.log(`      错误: ${e.message.slice(0, 100)}`);
        }
      }
    }

    console.log(`\n📊 执行结果: 成功 ${ok}, 跳过 ${skip}, 错误 ${err}\n`);

    // 验证
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `);
    const tables = res.rows.map(r => r.table_name);
    console.log(`📋 已创建 ${tables.length} 张表:\n   ${tables.join(', ')}\n`);
    console.log('🎉 数据库初始化完成！');
    console.log('   登录地址: http://localhost:3000');
    console.log('   管理员账号: admin / admin123');

    await client.end();
  } catch (e) {
    console.error('\n❌ 连接失败:', e.message);
    console.error('\n可能的原因:');
    console.error('  1. 网络不通 — 请确认能访问 supabase.com');
    console.error('  2. 密码错误 — 请检查 Supabase Settings > Database 中的密码');
    console.error('  3. 项目暂停 — 免费项目闲置可能被暂停，请在 Supabase 控制台恢复');
    process.exit(1);
  }
}

main();
