const $ = (id) => document.getElementById(id);

const loadingEl = $("loading");
const contentEl = $("content");
const errorEl = $("error");
const prevBtn = $("prev");
const nextBtn = $("next");
const todayBtn = $("today");

let index = [];
let currentDate = null;

init().catch((err) => showError(err.message || String(err)));

async function init() {
  index = await loadIndex();
  const latest = await fetchJson("./data/latest.json").catch(() => null);
  const startDate = latest?.date || index[index.length - 1];
  if (!startDate) {
    throw new Error("还没有日历数据。请先运行 npm run generate:mock 或配置 GitHub Actions。");
  }
  await showDate(startDate);
}

async function loadIndex() {
  try {
    const data = await fetchJson("./data/index.json");
    return Array.isArray(data) ? data.slice().sort() : [];
  } catch {
    return [];
  }
}

async function showDate(dateStr) {
  loadingEl.hidden = false;
  contentEl.hidden = true;
  errorEl.hidden = true;

  try {
    const data = await fetchJson(`./data/${dateStr}.json`);
    render(data);
    currentDate = dateStr;
    updateNav();
    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    showError(`找不到 ${dateStr} 的日历：${err.message}`);
  }
}

function render(data) {
  $("date").textContent = data.date;
  $("date").dateTime = data.date;
  $("weekday").textContent = data.weekday || "";
  const holiday = $("holiday");
  if (data.holiday) {
    holiday.hidden = false;
    holiday.textContent = data.holiday;
  } else {
    holiday.hidden = true;
  }

  $("title").textContent = data.title || "";
  $("subtitle").textContent = data.subtitle || "";
  $("quote").textContent = data.quote || "";
  $("daysToWeekend").textContent = formatDays(data.daysToWeekend);
  $("daysToPayday").textContent = formatDays(data.daysToPayday);
  $("mood").textContent = data.mood || "—";

  fillList($("suitable"), data.suitable);
  fillList($("avoid"), data.avoid);
  fillList($("tips"), data.tips);

  const src = data.source === "mock" ? "本地样例" : data.model || "llm";
  $("source").textContent = `生成于 ${formatTime(data.generatedAt)} · ${src}`;
}

function fillList(ul, items) {
  ul.replaceChildren();
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  }
}

function formatDays(n) {
  if (n === 0 || n === "0") return "就是今天";
  if (n == null) return "—";
  return `${n} 天`;
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function updateNav() {
  const i = index.indexOf(currentDate);
  prevBtn.disabled = i <= 0;
  nextBtn.disabled = i < 0 || i >= index.length - 1;
}

function showError(message) {
  loadingEl.hidden = true;
  contentEl.hidden = true;
  errorEl.hidden = false;
  errorEl.textContent = message;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

prevBtn.addEventListener("click", () => {
  const i = index.indexOf(currentDate);
  if (i > 0) showDate(index[i - 1]);
});

nextBtn.addEventListener("click", () => {
  const i = index.indexOf(currentDate);
  if (i >= 0 && i < index.length - 1) showDate(index[i + 1]);
});

todayBtn.addEventListener("click", async () => {
  const latest = await fetchJson("./data/latest.json").catch(() => null);
  const target = latest?.date || index[index.length - 1];
  if (target) showDate(target);
});
