const SESSION_KEY = "moneydesk_token_v2";

const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authSubmit = document.querySelector("#authSubmit");
const authMessage = document.querySelector("#authMessage");
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const currentUserLabel = document.querySelector("#currentUser");
const logoutButton = document.querySelector("#logoutButton");
const monthFilter = document.querySelector("#monthFilter");
const seedButton = document.querySelector("#seedButton");
const transactionForm = document.querySelector("#transactionForm");
const titleInput = document.querySelector("#titleInput");
const amountInput = document.querySelector("#amountInput");
const dateInput = document.querySelector("#dateInput");
const categoryInput = document.querySelector("#categoryInput");
const incomeTotal = document.querySelector("#incomeTotal");
const expenseTotal = document.querySelector("#expenseTotal");
const balanceTotal = document.querySelector("#balanceTotal");
const balanceHint = document.querySelector("#balanceHint");
const categoryChart = document.querySelector("#categoryChart");
const chartCaption = document.querySelector("#chartCaption");
const transactionTable = document.querySelector("#transactionTable");
const transactionCount = document.querySelector("#transactionCount");
const emptyState = document.querySelector("#emptyState");

let mode = "login";
let activeUser = "";
let transactions = [];

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
monthFilter.value = `${yyyy}-${mm}`;
dateInput.value = `${yyyy}-${mm}-${dd}`;

function getToken() {
  return localStorage.getItem(SESSION_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(SESSION_KEY, token);
}

function clearToken() {
  localStorage.removeItem(SESSION_KEY);
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "เกิดข้อผิดพลาด");
  }

  return data;
}

function normalizeName(name) {
  return name.trim().toLowerCase();
}

function money(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function thaiDate(value) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  authTitle.textContent = isLogin ? "เข้าสู่ระบบ" : "สมัครใช้งาน";
  authSubmit.textContent = isLogin ? "เข้าสู่ระบบ" : "สร้างบัญชี";
  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);
  passwordInput.autocomplete = isLogin ? "current-password" : "new-password";
  authMessage.textContent = "";
}

async function showApp(username) {
  activeUser = username;
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  currentUserLabel.textContent = activeUser;
  await refreshTransactions();
}

function showAuth() {
  activeUser = "";
  transactions = [];
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  authForm.reset();
  authMessage.textContent = "";
  setMode("login");
}

async function refreshTransactions() {
  const data = await api("/api/transactions");
  transactions = data.transactions || [];
  render();
}

function filteredTransactions() {
  return transactions
    .filter((item) => item.date.startsWith(monthFilter.value))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
}

function render() {
  const items = filteredTransactions();
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);
  const balance = income - expense;

  incomeTotal.textContent = money(income);
  expenseTotal.textContent = money(expense);
  balanceTotal.textContent = money(balance);
  balanceHint.textContent = balance >= 0 ? "กระแสเงินสดเป็นบวก" : "รายจ่ายสูงกว่ารายรับ";
  transactionCount.textContent = `${items.length} รายการ`;

  renderTable(items);
  renderChart(items);
}

function renderTable(items) {
  transactionTable.innerHTML = items
    .map((item) => {
      const sign = item.type === "income" ? "+" : "-";
      const typeText = item.type === "income" ? "รายรับ" : "รายจ่าย";
      return `
        <tr>
          <td>${thaiDate(item.date)}</td>
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td><span class="badge ${item.type}">${typeText}</span></td>
          <td class="right">${sign}${money(item.amount)}</td>
          <td class="right"><button class="delete-button" data-id="${item.id}" aria-label="ลบรายการ ${escapeHtml(item.title)}">x</button></td>
        </tr>
      `;
    })
    .join("");
  emptyState.classList.toggle("hidden", items.length > 0);
}

function renderChart(items) {
  const expenseItems = items.filter((item) => item.type === "expense");
  const byCategory = expenseItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const rows = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (!rows.length) {
    chartCaption.textContent = "ยังไม่มีรายจ่ายในเดือนนี้";
    categoryChart.innerHTML = `<p class="empty-state">เมื่อมีรายจ่าย ระบบจะแสดงหมวดหมู่ที่ใช้เงินมากที่สุดที่นี่</p>`;
    return;
  }

  const max = Math.max(...rows.map(([, value]) => value));
  chartCaption.textContent = `แสดง ${rows.length} หมวดหมู่สูงสุด`;
  categoryChart.innerHTML = rows
    .map(([category, value]) => {
      const width = Math.max(8, Math.round((value / max) * 100));
      return `
        <div class="bar-row">
          <span class="bar-label">${escapeHtml(category)}</span>
          <span class="bar-track"><span class="bar-fill" style="width: ${width}%"></span></span>
          <span class="bar-value right">${money(value)}</span>
        </div>
      `;
    })
    .join("");
}

function createTransaction(formData) {
  return {
    type: formData.get("type"),
    title: titleInput.value.trim(),
    amount: Number(amountInput.value),
    date: dateInput.value,
    category: categoryInput.value,
  };
}

async function seedDemoData() {
  seedButton.disabled = true;
  const month = monthFilter.value;
  const samples = [
    ["income", "เงินเดือน", 45000, `${month}-01`, "เงินเดือน"],
    ["income", "งานออกแบบโลโก้", 7200, `${month}-08`, "งานเสริม"],
    ["expense", "ค่าเช่าห้อง", 12000, `${month}-03`, "บ้าน"],
    ["expense", "กาแฟและอาหารกลางวัน", 1850, `${month}-11`, "อาหาร"],
    ["expense", "BTS และแท็กซี่", 1430, `${month}-14`, "เดินทาง"],
    ["expense", "ซื้อคีย์บอร์ด", 3200, `${month}-18`, "ช้อปปิ้ง"],
    ["expense", "วิตามิน", 890, `${month}-19`, "สุขภาพ"],
  ];

  try {
    for (const [type, title, amount, date, category] of samples) {
      await api("/api/transactions", {
        method: "POST",
        body: JSON.stringify({ type, title, amount, date, category }),
      });
    }
    await refreshTransactions();
  } catch (error) {
    alert(error.message);
  } finally {
    seedButton.disabled = false;
  }
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  authMessage.textContent = "";

  try {
    const username = normalizeName(usernameInput.value);
    const password = passwordInput.value;
    const path = mode === "register" ? "/api/register" : "/api/login";
    const data = await api(path, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    setToken(data.token);
    await showApp(data.username);
  } catch (error) {
    authMessage.textContent = error.message;
  } finally {
    authSubmit.disabled = false;
  }
});

logoutButton.addEventListener("click", () => {
  clearToken();
  showAuth();
});

monthFilter.addEventListener("change", render);
seedButton.addEventListener("click", seedDemoData);

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const transaction = createTransaction(new FormData(transactionForm));
  if (!transaction.title || transaction.amount <= 0 || !transaction.date) return;

  try {
    await api("/api/transactions", {
      method: "POST",
      body: JSON.stringify(transaction),
    });
    transactionForm.reset();
    document.querySelector("#typeIncome").checked = true;
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    await refreshTransactions();
  } catch (error) {
    alert(error.message);
  }
});

transactionTable.addEventListener("click", async (event) => {
  const button = event.target.closest(".delete-button");
  if (!button) return;

  try {
    await api(`/api/transactions/${button.dataset.id}`, { method: "DELETE" });
    await refreshTransactions();
  } catch (error) {
    alert(error.message);
  }
});

(async function init() {
  const token = getToken();
  if (!token) {
    showAuth();
    return;
  }

  try {
    const data = await api("/api/session");
    await showApp(data.username);
  } catch {
    clearToken();
    showAuth();
  }
})();
