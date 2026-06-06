const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// ============================================================
// 数据库初始化脚本 v2 - 增强版（多方式自动重试）
// 用法: cd /d E:\扣子调休管理系统\scripts\db-init && npm install && node init.js
// ============================================================

const PASSWORD = "lipugang461023";
const PROJECT_REF = "pnqfvfhqekgroliztnuo";

// 多种连接配置，按优先级尝试
const CONNECTIONS = [
  {
    name: "池化器(6543)",
    host: `${PROJECT_REF}.supabase.co`,
    port: 6543,
    database: "postgres",
    user: "postgres",
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
  },
  {
    name: "直连(5432)",
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
  },
  // Session mode pooler (支持事务)
  {
    name: "Session模式(5432)",
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: PASSWORD,
    ssl: { rejectUnauthorized: false },
    options: { keepAlive: true },
  },
];

const sqlPath = path.resolve(__dirname, "..", "init-db.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

async function tryConnect(config) {
  const client = new Client({
    ...config,
    ...config.options,
    connectionTimeoutMillis: 12000,
    query_timeout: 10000,
  });

  try {
    await client.connect();
    const res = await client.query("SELECT version()");
    console.log(`  ✅ ${config.name} 连接成功`);
    console.log(`     版本: ${res.rows[0].version.slice(0, 50)}`);
    return client;
  } catch (e) {
    try { await client.end().catch(() => {}); } catch (_) {}
    return null;
  }
}

async function main() {
  console.log("========================================");
  console.log("  调休管理系统 - 数据库自动初始化 v2");
  console.log("========================================\n");

  // 尝试所有连接方式
  let client = null;
  const usedConfigName = "";

  for (let i = 0; i < CONNECTIONS.length; i++) {
    const cfg = CONNECTIONS[i];
    console.log(`🔌 [${i + 1}/${CONNECTIONS.length}] 尝试: ${cfg.name}...`);

    // 先测试 TCP 端口是否可达
    if (i < 2) {
      const tcpOk = await testTCP(cfg.host, cfg.port);
      if (!tcpOk) {
        console.log(`  ⏸️ 端口不可达，跳过\n`);
        continue;
      }
      console.log(`  ✅ 端口可达，正在认证...`);
    }

    client = await tryConnect(cfg);
    if (client) break;
    console.log("");
  }

  if (!client) {
    console.error("\n❌ 所有连接方式均失败！");
    console.error("\n请手动在浏览器中执行：");
    console.error("\n  https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new");
    console.error("\n然后粘贴 scripts/init-db.sql 的内容并点击 Run");
    process.exit(1);
  }

  console.log(`\n📋 开始执行 ${statements.length} 条 SQL...\n`);

  let success = 0;
  let skipped = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    try {
      await client.query(stmt);
      success++;
      if (stmt.toUpperCase().includes("CREATE TABLE")) {
        const match = stmt.match(/CREATE TABLE.*?(\w+)/i);
        if (match) console.log(`  ✅ 创建表: ${match[1]}`);
      } else if (stmt.toUpperCase().includes("INSERT INTO")) {
        const match = stmt.match(/INSERT INTO\s+(\w+)/i);
        if (match && !match[1].includes("health_check")) console.log(`  ✅ 插入数据: ${match[1]}`);
      }
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("already exists") || msg.includes("duplicate key")) {
        skipped++;
        success++; // 已存在也算成功
      } else {
        console.error(`  ❌ 失败: ${msg.slice(0, 80)}`);
      }
    }
  }

  console.log(`\n📊 结果: 成功/跳过 ${success} | 失败 ${statements.length - skipped - success}`);

  // 验证
  const tablesRes = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  console.log(`\n📦 数据库表 (${tablesRes.rows.length}):`);
  tablesRes.rows.forEach(r => console.log(`   ✓ ${r.table_name}`));

  const adminRes = await client.query(
    "SELECT username, name, role_category FROM employees WHERE username='admin'"
  );
  if (adminRes.rows.length > 0) {
    const a = adminRes.rows[0];
    console.log(`\n👤 管理员账号: ${a.username} / ${a.name} (${a.role_category})`);
  }

  await client.end();
  console.log("\n🎉 初始化完成！访问 http://localhost:3000 用 admin / admin123 登录");
}

function testTCP(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const net = require("net");
    const socket = net.createConnection({ host, port, timeout });
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.on("error", () => resolve(false));
  });
}

main().catch(e => {
  console.error("致命错误:", e.message || e);
  process.exit(1);
});
