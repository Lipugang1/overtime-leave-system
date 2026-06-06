const https = require("https");
const fs = require("fs");
const path = require("path");

// ============================================================
// 通过 Supabase REST API (pg-meta) 初始化数据库
// 走 HTTP 443 端口，绕过 PostgreSQL 直连限制
// 用法: cd /d E:\扣子调休管理系统\scripts\db-init && node init-via-rest.js
// ============================================================

const PROJECT_REF = "pnqfvfhqekgroliztnuo";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWZ2ZmhxZWtncm9saXp0bnVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY5NTEzOSwiZXhwIjoyMDk2MjcxMTM5fQ.p4X4mwcZwAAsB_tvR8K3YdytXJwdvU5aWMwR_K74JCQ";

const sqlPath = path.resolve(__dirname, "..", "init-db.sql");
const sql = fs.readFileSync(sqlPath, "utf8");
const statements = sql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log("========================================");
console.log("  Supabase REST API 方式初始化数据库");
console.log("========================================\n");
console.log(`📋 共 ${statements.length} 条 SQL 待执行\n`);

let success = 0;
let failed = 0;
let skipped = 0;

function execSQL(query, i) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });

    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: "/rest/v1/rpc/exec_sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => {
        if (res.statusCode === 200) {
          success++;
          resolve({ ok: true, data });
        } else if (res.statusCode === 404) {
          // exec_sql 函数不存在，这是最常见的错误
          if (i === 0) {
            console.log("  ⚠️ 数据库 exec_sql 函数未创建，需要手动创建...\n");
          }
          resolve({ ok: false, status: 404, data: data.slice(0, 100) });
        } else {
          if (data.toLowerCase().includes("already exists")) {
            skipped++;
            resolve({ ok: true });
          } else {
            failed++;
            resolve({ ok: false, status: res.statusCode, data: data.slice(0, 200) });
          }
        }
      });
    });

    req.on("error", (e) => {
      failed++;
      resolve({ ok: false, error: e.message });
    });
    req.on("timeout", () => {
      req.destroy();
      failed++;
      resolve({ ok: false, error: "timeout" });
    });

    req.write(body);
    req.end();
  });
}

// 分批执行（避免请求过大）
(async () => {
  const tables = [];

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    process.stdout.write(`  执行 [${i + 1}/${statements.length}] ... `);

    const result = await execSQL(stmt, i);

    if (result.ok) {
      process.stdout.write("OK\n");
      // 记录创建成功的表名
      const match = stmt.match(/CREATE TABLE.*?\s+(\w+)/i);
      if (match) tables.push(match[1]);
    } else {
      process.stdout.write(`FAIL (${result.status || result.error})\n`);
    }
  }

  console.log(`\n📊 结果: 成功 ${success} | 跳过 ${skipped} | 失败 ${failed}`);

  // 检查表是否创建成功
  if (tables.length > 0) {
    console.log(`\n📦 已创建的表 (${tables.length}):`);
    tables.forEach((t) => console.log(`   ✓ ${t}`));
  }

  if (failed > 0) {
    console.log("\n⚠️ 部分语句失败，通常是因为表已存在或 exec_sql 函数未配置。");
    console.log("\n建议手动执行：");
    console.log(`  https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  } else {
    console.log("\n🎉 初始化完成！访问 http://localhost:3000 用 admin / admin123 登录");
  }
})();
