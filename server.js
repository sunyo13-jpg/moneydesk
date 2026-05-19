const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SECRET = process.env.SESSION_SECRET || "change-this-secret-before-production";
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const USE_POSTGRES = Boolean(process.env.DATABASE_URL);
const REQUIRE_DATABASE_URL = process.env.REQUIRE_DATABASE_URL === "true";

let pool = null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

async function initStore() {
  if (REQUIRE_DATABASE_URL && !USE_POSTGRES) {
    throw new Error("DATABASE_URL is required when REQUIRE_DATABASE_URL=true");
  }

  if (!USE_POSTGRES) {
    await ensureFileDb();
    return;
  }

  const { Pool } = require("pg");
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  await pool.query(`
    create table if not exists users (
      username text primary key,
      salt text not null,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
  `);

  await pool.query(`
    create table if not exists transactions (
      id uuid primary key,
      username text not null references users(username) on delete cascade,
      type text not null check (type in ('income', 'expense')),
      title text not null,
      amount numeric(14, 2) not null check (amount > 0),
      date date not null,
      category text not null,
      created_at bigint not null
    );
  `);

  await pool.query(`
    create index if not exists transactions_username_date_idx
    on transactions (username, date desc);
  `);
}

async function ensureFileDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ users: {} }, null, 2));
  }
}

async function readFileDb() {
  await ensureFileDb();
  const raw = await fs.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

async function writeFileDb(db) {
  await ensureFileDb();
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

async function getUser(username) {
  if (USE_POSTGRES) {
    const result = await pool.query(
      "select username, salt, password_hash as \"passwordHash\" from users where username = $1",
      [username],
    );
    return result.rows[0] || null;
  }

  const db = await readFileDb();
  return db.users[username] || null;
}

async function createUser(username, passwordData) {
  if (USE_POSTGRES) {
    await pool.query(
      "insert into users (username, salt, password_hash) values ($1, $2, $3)",
      [username, passwordData.salt, passwordData.hash],
    );
    return;
  }

  const db = await readFileDb();
  db.users[username] = {
    salt: passwordData.salt,
    passwordHash: passwordData.hash,
    transactions: [],
  };
  await writeFileDb(db);
}

async function listTransactions(username) {
  if (USE_POSTGRES) {
    const result = await pool.query(
      `
        select
          id::text,
          type,
          title,
          amount::float8 as amount,
          to_char(date, 'YYYY-MM-DD') as date,
          category,
          created_at as "createdAt"
        from transactions
        where username = $1
        order by date desc, created_at desc
      `,
      [username],
    );
    return result.rows;
  }

  const db = await readFileDb();
  return db.users[username]?.transactions || [];
}

async function addTransaction(username, transaction) {
  if (USE_POSTGRES) {
    await pool.query(
      `
        insert into transactions (id, username, type, title, amount, date, category, created_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        transaction.id,
        username,
        transaction.type,
        transaction.title,
        transaction.amount,
        transaction.date,
        transaction.category,
        transaction.createdAt,
      ],
    );
    return;
  }

  const db = await readFileDb();
  db.users[username].transactions = db.users[username].transactions || [];
  db.users[username].transactions.push(transaction);
  await writeFileDb(db);
}

async function deleteTransaction(username, id) {
  if (USE_POSTGRES) {
    await pool.query("delete from transactions where username = $1 and id = $2", [username, id]);
    return;
  }

  const db = await readFileDb();
  db.users[username].transactions = (db.users[username].transactions || []).filter((item) => item.id !== id);
  await writeFileDb(db);
}

function securityHeaders(contentType) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (contentType) headers["Content-Type"] = contentType;
  return headers;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...securityHeaders("application/json; charset=utf-8"),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function sign(payload) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

function createToken(username) {
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload = Buffer.from(JSON.stringify({ username, expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;

  const token = auth.slice(7);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.username || Date.now() > data.expiresAt) return null;
    return data.username;
  } catch {
    return null;
  }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateTransaction(body) {
  const type = body.type === "income" ? "income" : body.type === "expense" ? "expense" : "";
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const amount = Number(body.amount);
  const date = String(body.date || "");

  if (!type) return "ประเภทไม่ถูกต้อง";
  if (!title) return "กรุณากรอกรายละเอียด";
  if (!category) return "กรุณาเลือกหมวดหมู่";
  if (!Number.isFinite(amount) || amount <= 0) return "จำนวนเงินต้องมากกว่า 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "วันที่ไม่ถูกต้อง";

  return null;
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || "");

      if (username.length < 3) return sendJson(res, 400, { error: "ชื่อผู้ใช้อย่างน้อย 3 ตัวอักษร" });
      if (password.length < 4) return sendJson(res, 400, { error: "รหัสผ่านอย่างน้อย 4 ตัวอักษร" });

      if (await getUser(username)) return sendJson(res, 409, { error: "ชื่อผู้ใช้นี้มีอยู่แล้ว" });

      const passwordData = hashPassword(password);
      await createUser(username, passwordData);
      return sendJson(res, 201, { username, token: createToken(username) });
    }

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const username = normalizeUsername(body.username);
      const password = String(body.password || "");
      const user = await getUser(username);

      if (!user || !verifyPassword(password, user)) {
        return sendJson(res, 401, { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
      }

      return sendJson(res, 200, { username, token: createToken(username) });
    }

    const username = readToken(req);
    if (!username) return sendJson(res, 401, { error: "กรุณาเข้าสู่ระบบใหม่" });

    const user = await getUser(username);
    if (!user) return sendJson(res, 401, { error: "ไม่พบบัญชีผู้ใช้" });

    if (req.method === "GET" && url.pathname === "/api/session") {
      return sendJson(res, 200, { username });
    }

    if (req.method === "GET" && url.pathname === "/api/transactions") {
      return sendJson(res, 200, { transactions: await listTransactions(username) });
    }

    if (req.method === "POST" && url.pathname === "/api/transactions") {
      const body = await readBody(req);
      const error = validateTransaction(body);
      if (error) return sendJson(res, 400, { error });

      const transaction = {
        id: crypto.randomUUID(),
        type: body.type,
        title: String(body.title).trim(),
        amount: Number(body.amount),
        date: String(body.date),
        category: String(body.category).trim(),
        createdAt: Date.now(),
      };

      await addTransaction(username, transaction);
      return sendJson(res, 201, { transaction });
    }

    if (req.method === "DELETE" && url.pathname.startsWith("/api/transactions/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/transactions/", ""));
      await deleteTransaction(username, id);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "ไม่พบ API นี้" });
  } catch (error) {
    return sendJson(res, 500, { error: "Server error", detail: error.message });
  }
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT) || filePath.includes(`${path.sep}data${path.sep}`)) {
    res.writeHead(403, securityHeaders("text/plain; charset=utf-8"));
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      ...securityHeaders(contentType),
      "Cache-Control": contentType.includes("html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(file);
  } catch {
    res.writeHead(404, securityHeaders("text/plain; charset=utf-8"));
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      store: USE_POSTGRES ? "postgres" : "file",
      uptime: Math.round(process.uptime()),
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }

  await serveStatic(req, res, url);
});

initStore().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    const storeName = USE_POSTGRES ? "PostgreSQL" : "local JSON file";
    console.log(`MoneyDesk is running on http://localhost:${PORT} using ${storeName}`);
  });
}).catch((error) => {
  console.error(error);
  process.exit(1);
});

async function shutdown() {
  server.close(async () => {
    if (pool) await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
