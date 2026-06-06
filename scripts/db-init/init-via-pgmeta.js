const https = require("https");
const fs = require("fs");
const path = require("path");

// ============================================================
// 通过 Supabase pg-meta API 初始化数据库（管理面板内部接口）
// 走 HTTP 443 端口，不需要直连数据库
// 用法: node init-via-pgmeta.js
// ============================================================

const PROJECT_REF = "pnqfvfhqekgroliztnuo";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucWZ2ZmhxZWtncm9saXp0bnVvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY5NTEzOSwiZXhwIjoyMDk2MjcxMTM5fQ.p4X4mwcZwAAsB_tvR8K3YdytXJwdvU5aWMwR_K74JCQ";

const sqlPath = path.resolve(__dirname, "..", "init-db.sql");
const sql = fs.readFileSync(sqlPath, "utf8");

console.log("========================================");
console.log("  Supabase pg-meta API 初始化数据库");
console.log("========================================\n");

// 方法1：pg-meta /query 接口
function pgMetaQuery(query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: "/pg-meta/v1/query",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
      },
      timeout: 20000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

// 方法2：/pg-meta/run-sql 接口
function pgMetaRunSQL(query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      sql: query,
      schema: "public"
    });
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: "/pg-meta/run-sql",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
      },
      timeout: 20000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

// 方法3：/pg/restapi/sqlexec 接口
function sqlexec(query) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ query });
    const options = {
      hostname: `${PROJECT_REF}.supabase.co`,
      path: "/pg/restapi/sqlexec",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        apikey: SERVICE_KEY,
        Authorization: "Bearer " + SERVICE_KEY,
      },
      timeout: 20000,
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, body: data }));
    });
    req.on("error", (e) => resolve({ error: e.message }));
    req.on("timeout", () => { req.destroy(); resolve({ error: "timeout" }); });
    req.write(body);
    req.end();
  });
}

(async () => {
  // 先测试哪个接口可用
  console.log("🔍 测试可用接口...\n");

  const testSQL = "SELECT 1 as test;";
  
  console.log("[1] 尝试 /pg-meta/v1/query ...");
  let r1 = await pgMetaQuery(testSQL);
  console.log(`    → ${r1.status || r1.error}\n`);

  if (!r1.error && r1.status !== 404) {
    // 使用 pg-meta /query 接口执行完整 SQL
    console.log(`✅ 找到可用接口！开始初始化...\n`);
    
    const stmts = sql.split(";").map(s=>s.trim()).filter(s=>s.length>0 && !s.startsWith("--"));
    for (let i=0; i<stmts.length; i++) {
      process.stdout.write(`  [${i+1}/${stmts.length}] ... `);
      const result = await pgMetaQuery(stmts[i]);
      if (!result.error) {
        process.stdout.write(result.status === 200 || result.status === 201 ? "✅\n" : `⚠️ ${result.status}\n`);
      } else {
        process.stdout.write(`❌ ${result.error}\n`);
      }
    }
    return;
  }

  console.log("[2] 尝试 /pg-meta/run-sql ...");
  let r2 = await pgMetaRunSQL(testSQL);
  console.log(`    → ${r2.status || r2.error}\n`);

  if (!r2.error && r2.status !== 404) {
    console.log(`✅ run-sql 可用！开始初始化...\n`);
    const stmts = sql.split(";").map(s=>s.trim()).filter(s=>s.length>0 && !s.startsWith("--"));
    for (let i=0; i<stmts.length; i++) {
      process.stdout.write(`  [${i+1}/${stmts.length}] ... `);
      const result = await pgMetaRunSQL(stmts[i]);
      if (!result.error) {
        process.stdout.write(result.status === 200 || result.status === 201 ? "✅\n" : `⚠️ ${result.status}\n`);
      } else {
        process.stdout.write(`❌ ${result.error}\n`);
      }
    }
    return;
  }

  console.log("[3] 尝试 /pg/restapi/sqlexec ...");
  let r3 = await sqlexec(testSQL);
  console.log(`    → ${r3.status || r3.error}\n`);

  if (!r3.error && r3.status !== 404) {
    console.log(`✅ sqlexec 可用！开始初始化...\n`);
    const stmts = sql.split(";").map(s=>s.trim()).filter(s=>s.length>0 && !s.startsWith("--"));
    for (let i=0; i<stmts.length; i++) {
      process.stdout.write(`  [${i+1}/${stmts.length}] ... `);
      const result = await sqlexec(stmts[i]);
      if (!result.error) {
        process.stdout.write(result.status === 200 || result.status === 201 ? "✅\n" : `⚠️ ${result.status}\n`);
      } else {
        process.stdout.write(`❌ ${result.error}\n`);
      }
    }
    return;
  }

  // 所有接口都不行，输出手动操作指南
  console.log("\n❌ 所有远程接口均不可用。\n");
  console.log("请使用浏览器手动执行以下步骤：\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("步骤1：打开浏览器访问以下网址：");
  console.log("");
  console.log("  https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new");
  console.log("");
  console.log("步骤2：复制下面的所有内容，粘贴到编辑器中：");
  console.log("步骤3：点击右下角 Run 按钮执行\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // 输出 SQL 内容方便复制
  console.log("--- 复制从这里开始 ---\n");
  console.log(sql);
  console.log("\n--- 复制到这里结束 ---\n");
})();
