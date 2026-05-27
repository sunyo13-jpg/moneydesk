const SESSION_KEY = "moneydesk_token_v2";

const authView = document.querySelector("#authView");
const appView = document.querySelector("#appView");
const authForm = document.querySelector("#authForm");
const authTitle = document.querySelector("#authTitle");
const authSubmit = document.querySelector("#authSubmit");
const authMessage = document.querySelector("#authMessage");
const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");
const passwordTab = document.querySelector("#passwordTab");
const usernameInput = document.querySelector("#username");
const passwordInput = document.querySelector("#password");
const newPasswordLabel = document.querySelector("#newPasswordLabel");
const newPasswordInput = document.querySelector("#newPassword");
const currentUserLabel = document.querySelector("#currentUser");
const logoutButton = document.querySelector("#logoutButton");
const monthFilter = document.querySelector("#monthFilter");
const themeToggle = document.querySelector("#themeToggle");
const transactionForm = document.querySelector("#transactionForm");
const transactionSubmit = document.querySelector("#transactionSubmit");
const cancelEditButton = document.querySelector("#cancelEditButton");
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
const financeLineChart = document.querySelector("#financeLineChart");
const lineChartCaption = document.querySelector("#lineChartCaption");
const monthlyChartTab = document.querySelector("#monthlyChartTab");
const weeklyChartTab = document.querySelector("#weeklyChartTab");
const transactionTable = document.querySelector("#transactionTable");
const transactionCount = document.querySelector("#transactionCount");
const emptyState = document.querySelector("#emptyState");
const onlineCount = document.querySelector("#onlineCount");
const adviceForm = document.querySelector("#adviceForm");
const adviceIncome = document.querySelector("#adviceIncome");
const adviceHousing = document.querySelector("#adviceHousing");
const adviceDebt = document.querySelector("#adviceDebt");
const adviceExpense = document.querySelector("#adviceExpense");
const savingTarget = document.querySelector("#savingTarget");
const debtRatio = document.querySelector("#debtRatio");
const debtStatus = document.querySelector("#debtStatus");
const emergencyTarget = document.querySelector("#emergencyTarget");
const adviceNote = document.querySelector("#adviceNote");
const taxForm = document.querySelector("#taxForm");
const taxMonthlyIncome = document.querySelector("#taxMonthlyIncome");
const taxOtherIncome = document.querySelector("#taxOtherIncome");
const taxSocialSecurity = document.querySelector("#taxSocialSecurity");
const taxOtherDeduction = document.querySelector("#taxOtherDeduction");
const taxWithheld = document.querySelector("#taxWithheld");
const taxableIncome = document.querySelector("#taxableIncome");
const estimatedTax = document.querySelector("#estimatedTax");
const effectiveTaxRate = document.querySelector("#effectiveTaxRate");
const taxBalance = document.querySelector("#taxBalance");
const taxBalanceHint = document.querySelector("#taxBalanceHint");
const taxBreakdown = document.querySelector("#taxBreakdown");

let mode = "login";
let activeUser = "";
let transactions = [];
let theme = localStorage.getItem("moneydesk_theme") || "light";
let chartView = localStorage.getItem("moneydesk_chart_view") || "monthly";
let editingId = "";
let presenceTimer = null;

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
monthFilter.value = `${yyyy}-${mm}`;
dateInput.value = `${yyyy}-${mm}-${dd}`;

applyTheme(theme);

function getToken() {
  return localStorage.getItem(SESSION_KEY) || "";
}

function setToken(token) {
  localStorage.setItem(SESSION_KEY, token);
}

function clearToken() {
  localStorage.removeItem(SESSION_KEY);
}

function applyTheme(nextTheme) {
  theme = nextTheme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("moneydesk_theme", theme);
  if (themeToggle) {
    themeToggle.textContent = theme === "dark" ? "โหมดสว่าง" : "โหมดมืด";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด");
  }
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

function monthLabel(monthKey) {
  return new Intl.DateTimeFormat("th-TH", {
    month: "short",
    year: "2-digit",
  }).format(new Date(`${monthKey}-01T00:00:00`));
}

function addMonths(monthKey, offset) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekOfMonth(dateValue) {
  const day = Number(dateValue.slice(8, 10));
  return Math.min(5, Math.ceil(day / 7));
}

function summarize(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.type] += item.amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
}

function setChartView(nextView) {
  chartView = nextView === "weekly" ? "weekly" : "monthly";
  localStorage.setItem("moneydesk_chart_view", chartView);
  monthlyChartTab.classList.toggle("active", chartView === "monthly");
  weeklyChartTab.classList.toggle("active", chartView === "weekly");
  renderLineChart();
}

function setMode(nextMode) {
  mode = nextMode;
  const isLogin = mode === "login";
  const isRegister = mode === "register";
  const isPassword = mode === "password";
  authTitle.textContent = isLogin ? "เข้าสู่ระบบ" : isRegister ? "สมัครใช้งาน" : "แก้ไขรหัสผ่าน";
  authSubmit.textContent = isLogin ? "เข้าสู่ระบบ" : isRegister ? "สร้างบัญชี" : "บันทึกรหัสผ่านใหม่";
  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", isRegister);
  passwordTab.classList.toggle("active", isPassword);
  newPasswordLabel.classList.toggle("hidden", !isPassword);
  newPasswordInput.required = isPassword;
  passwordInput.autocomplete = isLogin || isPassword ? "current-password" : "new-password";
  passwordInput.placeholder = isPassword ? "รหัสผ่านเดิม" : "อย่างน้อย 4 ตัวอักษร";
  authMessage.textContent = "";
}

async function showApp(username) {
  activeUser = username;
  authView.classList.add("hidden");
  appView.classList.remove("hidden");
  currentUserLabel.textContent = activeUser;
  await refreshTransactions();
  startPresence();
}

function showAuth() {
  activeUser = "";
  transactions = [];
  stopPresence();
  appView.classList.add("hidden");
  authView.classList.remove("hidden");
  authForm.reset();
  authMessage.textContent = "";
  setMode("login");
}

async function updatePresence() {
  if (!getToken()) return;
  try {
    const data = await api("/api/presence", { method: "POST" });
    onlineCount.textContent = data.online ?? 0;
  } catch {
    onlineCount.textContent = "0";
  }
}

function startPresence() {
  stopPresence();
  updatePresence();
  presenceTimer = setInterval(updatePresence, 30000);
}

function stopPresence() {
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = null;
  if (onlineCount) onlineCount.textContent = "0";
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
  transactionCount.textContent = `${monthLabel(monthFilter.value)} · ${items.length} รายการ`;

  renderTable(items);
  renderChart(items);
  renderLineChart();
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
          <td class="right table-actions">
            <button class="edit-button" data-id="${item.id}" aria-label="แก้ไขรายการ ${escapeHtml(item.title)}">แก้ไข</button>
            <button class="delete-button" data-id="${item.id}" aria-label="ลบรายการ ${escapeHtml(item.title)}">x</button>
          </td>
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

  const total = rows.reduce((sum, [, value]) => sum + value, 0);
  const palette = ["#20b486", "#2d7ff9", "#f05c7a", "#f6aa3d", "#8b5cf6", "#14b8a6"];
  chartCaption.textContent = `ใช้จ่ายรวม ${money(total)} · ${rows.length} หมวดหมู่`;
  let start = 0;
  const segments = rows.map(([category, value], index) => {
    const percentExact = (value / total) * 100;
    const end = start + percentExact;
    const color = palette[index % palette.length];
    const segment = `${color} ${start}% ${end}%`;
    start = end;
    return { category, value, color, percent: Math.round(percentExact), segment };
  });

  categoryChart.innerHTML = `
    <div class="pie-card">
      <div class="donut-chart" style="--segments: ${segments.map((item) => item.segment).join(", ")}">
        <div>
          <small>รวม</small>
          <strong>${money(total)}</strong>
        </div>
      </div>
    </div>
    <div class="pie-legend">
      ${segments
        .map((item, index) => {
          return `
            <div class="legend-row" style="--category-color: ${item.color}">
              <span class="legend-rank">${index + 1}</span>
              <div>
                <strong>${escapeHtml(item.category)} <em>${item.percent}%</em></strong>
                <small>${money(item.value)}</small>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLineChart() {
  const rows = chartView === "weekly" ? weeklyChartRows() : monthlyChartRows();
  const itemCount = rows.reduce((sum, row) => sum + row.count, 0);

  lineChartCaption.textContent =
    chartView === "weekly"
      ? `${monthLabel(monthFilter.value)} · ${itemCount} รายการ`
      : `${rows[0].label} - ${rows[rows.length - 1].label} · ${itemCount} รายการ`;

  monthlyChartTab.classList.toggle("active", chartView === "monthly");
  weeklyChartTab.classList.toggle("active", chartView === "weekly");
  renderSvgBarChart(rows);
}

function weeklyChartRows() {
  const monthItems = transactions.filter((item) => item.date.startsWith(monthFilter.value));
  const rows = Array.from({ length: 5 }, (_, index) => ({
    label: `สัปดาห์ ${index + 1}`,
    income: 0,
    expense: 0,
    count: 0,
  }));

  monthItems.forEach((item) => {
    const row = rows[weekOfMonth(item.date) - 1];
    row[item.type] += item.amount;
    row.count += 1;
  });

  return rows;
}

function monthlyChartRows() {
  const months = Array.from({ length: 6 }, (_, index) => addMonths(monthFilter.value, index - 5));
  return months.map((monthKey) => {
    const items = transactions.filter((item) => item.date.startsWith(monthKey));
    const summary = summarize(items);
    return {
      label: monthLabel(monthKey),
      income: summary.income,
      expense: summary.expense,
      count: items.length,
    };
  });
}

function renderSvgBarChart(rows) {
  const width = 900;
  const height = 350;
  const padding = { top: 64, right: 38, bottom: 62, left: 28 };
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.income, row.expense]));
  const hasData = rows.some((row) => row.income || row.expense);
  const groupWidth = (width - padding.left - padding.right) / rows.length;
  const usableHeight = height - padding.top - padding.bottom;
  const yFor = (value) => padding.top + usableHeight - (value / maxValue) * usableHeight;
  const xFor = (index) => padding.left + groupWidth * (index + 0.5);
  const gridRatios = [1, 0.75, 0.5, 0.25, 0];
  const barWidth = Math.min(42, Math.max(24, groupWidth * 0.24));
  const barGap = Math.min(14, Math.max(8, groupWidth * 0.08));
  const baseline = padding.top + usableHeight;
  const valueLabel = (value, x, y, kind) =>
    value > 0 ? `<text class="bar-value-label ${kind}-label" x="${x}" y="${Math.max(22, y - 12)}" text-anchor="middle">${money(value)}</text>` : "";

  financeLineChart.innerHTML = `
    <div class="chart-legend" aria-hidden="true">
      <span><i class="legend-income"></i>รายรับ</span>
      <span><i class="legend-expense"></i>รายจ่าย</span>
    </div>
    ${
      hasData
        ? `
          <svg class="line-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="กราฟแท่งรายรับรายจ่าย">
            ${gridRatios
              .map((ratio) => {
                const y = padding.top + usableHeight - ratio * usableHeight;
                return `
                  <line class="grid-line" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
                `;
              })
              .join("")}
            ${rows
              .map((row, index) => {
                const x = xFor(index);
                return `
                  <g>
                    ${renderBar(row.income, x - barWidth - barGap / 2, "income")}
                    ${renderBar(row.expense, x + barGap / 2, "expense")}
                    <text class="axis-label x-label" x="${x}" y="${height - 24}" text-anchor="middle">${escapeHtml(row.label)}</text>
                    <text class="axis-label count-label" x="${x}" y="${height - 7}" text-anchor="middle">${row.count} รายการ</text>
                  </g>
                `;
              })
              .join("")}
          </svg>
        `
        : `<p class="empty-state">ยังไม่มีข้อมูลสำหรับกราฟนี้</p>`
    }
  `;

  function renderBar(value, x, kind) {
    const y = yFor(value);
    const barHeight = Math.max(0, baseline - y);
    const visibleHeight = value > 0 ? Math.max(8, barHeight) : 0;
    const barY = baseline - visibleHeight;
    const centerX = x + barWidth / 2;
    return `
      <rect class="chart-bar ${kind}-bar" x="${x}" y="${barY}" width="${barWidth}" height="${visibleHeight}" rx="12"></rect>
      ${valueLabel(value, centerX, barY, kind)}
    `;
  }
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

function calculateAdvice() {
  const income = Number(adviceIncome.value) || 0;
  const housing = Number(adviceHousing.value) || 0;
  const debt = Number(adviceDebt.value) || 0;
  const essentialExpense = Number(adviceExpense.value) || 0;
  const totalDebt = housing + debt;
  const dti = income > 0 ? (totalDebt / income) * 100 : 0;
  const housingRatio = income > 0 ? (housing / income) * 100 : 0;
  const savingLow = income * 0.1;
  const savingHigh = income * 0.2;
  const emergencyLow = essentialExpense * 3;
  const emergencyHigh = essentialExpense * 6;

  savingTarget.textContent = income ? `${money(savingLow)} - ${money(savingHigh)}` : money(0);
  debtRatio.textContent = `${Math.round(dti)}%`;
  emergencyTarget.textContent = essentialExpense ? `${money(emergencyLow)} - ${money(emergencyHigh)}` : money(0);

  let status = "กรอกข้อมูลเพื่อประเมิน";
  let tone = "neutral";
  if (income > 0) {
    if (dti <= 36 && housingRatio <= 28) {
      status = "อยู่ในกรอบปลอดภัยตามแนวทาง 28/36";
      tone = "good";
    } else if (dti <= 43) {
      status = "เริ่มตึง ควรระวังการก่อหนี้เพิ่ม";
      tone = "warn";
    } else {
      status = "ภาระหนี้สูง เสี่ยงกระทบกระแสเงินสด";
      tone = "danger";
    }
  }

  debtStatus.textContent = status;
  adviceNote.dataset.tone = tone;
  adviceNote.innerHTML = `
    <strong>ผลประเมินเบื้องต้น</strong>
    <p>ค่าที่อยู่อาศัยของคุณอยู่ที่ ${Math.round(housingRatio)}% ของรายได้ และภาระหนี้รวมอยู่ที่ ${Math.round(dti)}% ของรายได้ เป้าหมายที่ใช้เป็นแนวทางคือที่อยู่อาศัยไม่เกิน 28%, หนี้รวมไม่เกิน 36%, และควรระวังมากเมื่อเกิน 43% พร้อมกันนี้ควรค่อยๆ สร้างเงินสำรองฉุกเฉิน 3-6 เดือนของรายจ่ายจำเป็น</p>
  `;
}

const TAX_BRACKETS = [
  { min: 0, max: 150000, rate: 0 },
  { min: 150000, max: 300000, rate: 0.05 },
  { min: 300000, max: 500000, rate: 0.1 },
  { min: 500000, max: 750000, rate: 0.15 },
  { min: 750000, max: 1000000, rate: 0.2 },
  { min: 1000000, max: 2000000, rate: 0.25 },
  { min: 2000000, max: 5000000, rate: 0.3 },
  { min: 5000000, max: Infinity, rate: 0.35 },
];

function calculateProgressiveTax(netIncome) {
  let tax = 0;
  const rows = [];

  TAX_BRACKETS.forEach((bracket) => {
    const taxableInBracket = Math.max(0, Math.min(netIncome, bracket.max) - bracket.min);
    const bracketTax = taxableInBracket * bracket.rate;
    if (taxableInBracket > 0 || bracket.min === 0) {
      rows.push({
        range: bracket.max === Infinity ? `${money(bracket.min + 1)} ขึ้นไป` : `${money(bracket.min + 1)} - ${money(bracket.max)}`,
        rate: bracket.rate,
        amount: taxableInBracket,
        tax: bracketTax,
      });
    }
    tax += bracketTax;
  });

  return { tax, rows };
}

function calculateTax() {
  const annualSalary = (Number(taxMonthlyIncome.value) || 0) * 12;
  const otherIncome = Number(taxOtherIncome.value) || 0;
  const grossIncome = annualSalary + otherIncome;
  const expenseDeduction = Math.min(grossIncome * 0.5, 100000);
  const personalAllowance = 60000;
  const socialSecurity = Math.min(Number(taxSocialSecurity.value) || 0, 9000);
  const otherDeduction = Number(taxOtherDeduction.value) || 0;
  const withheld = Number(taxWithheld.value) || 0;
  const netIncome = Math.max(0, grossIncome - expenseDeduction - personalAllowance - socialSecurity - otherDeduction);
  const result = calculateProgressiveTax(netIncome);
  const balance = result.tax - withheld;
  const averageRate = grossIncome > 0 ? (result.tax / grossIncome) * 100 : 0;

  taxableIncome.textContent = money(netIncome);
  estimatedTax.textContent = money(result.tax);
  effectiveTaxRate.textContent = `อัตราเฉลี่ย ${averageRate.toFixed(2)}%`;
  taxBalance.textContent = money(Math.abs(balance));
  taxBalanceHint.textContent = balance > 0 ? "ควรเตรียมจ่ายเพิ่ม" : balance < 0 ? "อาจมีสิทธิขอคืน" : "พอดีกับภาษีที่ถูกหักไว้";

  taxBreakdown.innerHTML = `
    <strong>รายละเอียดการคำนวณ</strong>
    <div class="tax-summary-line">
      <span>เงินได้ทั้งปี</span><b>${money(grossIncome)}</b>
      <span>หักค่าใช้จ่าย 50% สูงสุด 100,000</span><b>${money(expenseDeduction)}</b>
      <span>ค่าลดหย่อนส่วนตัว</span><b>${money(personalAllowance)}</b>
      <span>ประกันสังคมที่นำมาคิด</span><b>${money(socialSecurity)}</b>
      <span>ลดหย่อนอื่นๆ</span><b>${money(otherDeduction)}</b>
    </div>
    <div class="tax-bracket-list">
      ${result.rows
        .filter((row) => row.amount > 0)
        .map((row) => `
          <div>
            <span>${row.range}</span>
            <small>${Math.round(row.rate * 100)}%</small>
            <strong>${money(row.tax)}</strong>
          </div>
        `)
        .join("") || `<p class="empty-state">ยังไม่มีภาษีในขั้นบันได เพราะเงินได้สุทธิไม่เกินช่วงยกเว้น</p>`}
    </div>
  `;
}

function startEdit(item) {
  editingId = item.id;
  document.querySelector(item.type === "income" ? "#typeIncome" : "#typeExpense").checked = true;
  titleInput.value = item.title;
  amountInput.value = item.amount;
  dateInput.value = item.date;
  categoryInput.value = item.category;
  transactionSubmit.textContent = "บันทึกการแก้ไข";
  cancelEditButton.classList.remove("hidden");
  transactionForm.scrollIntoView({ behavior: "smooth", block: "center" });
}

function stopEdit() {
  editingId = "";
  transactionForm.reset();
  document.querySelector("#typeIncome").checked = true;
  dateInput.value = `${yyyy}-${mm}-${dd}`;
  transactionSubmit.textContent = "บันทึกรายการ";
  cancelEditButton.classList.add("hidden");
}

loginTab.addEventListener("click", () => setMode("login"));
registerTab.addEventListener("click", () => setMode("register"));
passwordTab.addEventListener("click", () => setMode("password"));

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authSubmit.disabled = true;
  authMessage.textContent = "";

  try {
    const username = normalizeName(usernameInput.value);
    const password = passwordInput.value;
    if (mode === "password") {
      await api("/api/change-password", {
        method: "POST",
        body: JSON.stringify({
          username,
          currentPassword: password,
          newPassword: newPasswordInput.value,
        }),
      });
      authForm.reset();
      setMode("login");
      authMessage.textContent = "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว ลองเข้าสู่ระบบอีกครั้ง";
      return;
    }

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
themeToggle.addEventListener("click", () => applyTheme(theme === "dark" ? "light" : "dark"));
monthlyChartTab.addEventListener("click", () => setChartView("monthly"));
weeklyChartTab.addEventListener("click", () => setChartView("weekly"));
cancelEditButton.addEventListener("click", stopEdit);
adviceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateAdvice();
});
taxForm.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateTax();
});

transactionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const transaction = createTransaction(new FormData(transactionForm));
  if (!transaction.title || transaction.amount <= 0 || !transaction.date) return;

  try {
    await api(editingId ? `/api/transactions/${editingId}` : "/api/transactions", {
      method: editingId ? "PUT" : "POST",
      body: JSON.stringify(transaction),
    });
    stopEdit();
    await refreshTransactions();
  } catch (error) {
    alert(error.message);
  }
});

transactionTable.addEventListener("click", async (event) => {
  const editButton = event.target.closest(".edit-button");
  if (editButton) {
    const item = transactions.find((transaction) => transaction.id === editButton.dataset.id);
    if (item) startEdit(item);
    return;
  }

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
