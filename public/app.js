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
  if (latest) fillCover(latest);
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
    document.title = `摸鱼人日历 · ${data.date?.replaceAll("-", ".") || dateStr}`;
    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    showError(`找不到 ${dateStr} 的日历：${err.message}`);
  }
}

function fillCover(data) {
  $("coverTitle").textContent = data.slogan || "今日宜摸鱼";
  $("coverSub").textContent = coverSubFrom(data);
}

function coverSubFrom(data) {
  const bless = String(data.bless || "")
    .split(/\n/)
    .map((line) => line.replace(/^寄语[：:]\s*/, "").trim())
    .find(Boolean);
  if (bless) return bless;
  return data.headerLine || "给打工人的一点体面松弛";
}

function render(data) {
  fillCover(data);

  $("dayNum").textContent = String(data.day ?? data.date?.slice(-2) ?? "").padStart(2, "0");
  $("weekday").textContent = data.weekday || "";
  $("yearMonth").textContent = [data.yearMonth, data.ganzhi].filter(Boolean).join(" · ");
  $("headerLine").textContent = data.headerLine || [data.lunar, data.zodiac].filter(Boolean).join(" · ");

  const holiday = $("holiday");
  if (data.holiday) {
    holiday.hidden = false;
    holiday.textContent = `今日节日：${data.holiday}`;
  } else {
    holiday.hidden = true;
  }

  $("status").textContent = data.status || "";
  $("slogan").textContent = data.slogan || "今天你摸鱼了吗？";
  $("bless").textContent = data.bless || "";

  fillList($("suitable"), data.suitable);
  fillList($("avoid"), data.avoid);
  renderFood(data.food);
  renderMovies(data.movies);
  renderCountdowns(data.countdowns);
  renderPaydays(data.paydays, data.paydayMonth);

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

function renderFood(food = {}) {
  const root = $("food");
  root.replaceChildren();
  const rows = [
    ["主食", food.staple],
    ["小吃", food.snack],
    ["汤", food.soup],
    ["点心", food.dessert],
  ];
  for (const [k, v] of rows) {
    const div = document.createElement("div");
    div.className = "food-item";
    div.innerHTML = `<div class="food-k"></div><div class="food-v"></div>`;
    div.querySelector(".food-k").textContent = k;
    div.querySelector(".food-v").textContent = v || "—";
    root.appendChild(div);
  }
}

function renderMovies(movies = []) {
  const root = $("movies");
  root.replaceChildren();
  for (const m of movies) {
    const div = document.createElement("div");
    div.className = "movie";
    const title = m.year ? `${m.title}` : m.title;
    const blurb = m.year ? `${m.year} · ${m.blurb || ""}` : m.blurb || "";
    div.innerHTML = `<div class="movie-n"></div><div class="movie-d"></div>`;
    div.querySelector(".movie-n").textContent = title;
    div.querySelector(".movie-d").textContent = blurb;
    root.appendChild(div);
  }
}

function renderCountdowns(items = []) {
  const root = $("countdowns");
  root.replaceChildren();
  for (const item of items) {
    const div = document.createElement("div");
    div.className = item.hot ? "cd hot" : "cd";
    div.innerHTML = `
      <div class="cd-name"></div>
      <div class="cd-num"></div>
      <div class="cd-date"></div>
    `;
    div.querySelector(".cd-name").textContent = item.name;
    const num = div.querySelector(".cd-num");
    if (item.days === 0) {
      num.textContent = "今天";
    } else {
      num.innerHTML = "";
      num.appendChild(document.createTextNode(String(item.days)));
      const span = document.createElement("span");
      span.textContent = "天";
      num.appendChild(span);
    }
    div.querySelector(".cd-date").textContent = item.date || "";
    root.appendChild(div);
  }
}

function renderPaydays(items = [], month) {
  $("paydayTitle").textContent = month
    ? `倒计时 · 薪资篇（本月 ${month} 月）`
    : "倒计时 · 薪资篇";
  const root = $("paydays");
  root.replaceChildren();
  for (const item of items) {
    const div = document.createElement("div");
    div.className = "pay-item";
    div.innerHTML = `<div class="pay-p"></div><div class="pay-d"></div>`;
    div.querySelector(".pay-p").textContent = item.label;
    const d = div.querySelector(".pay-d");
    if (item.days === 0) {
      d.textContent = "今天";
    } else {
      d.innerHTML = "";
      d.appendChild(document.createTextNode(String(item.days)));
      const span = document.createElement("span");
      span.textContent = " 天";
      d.appendChild(span);
    }
    root.appendChild(div);
  }
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
