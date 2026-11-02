#!/usr/bin/env node
/**
 * 生成当日摸鱼人日历 JSON → public/data/YYYY-MM-DD.json + latest.json
 * 依赖环境变量：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
 * MOCK=1 时跳过模型，写入本地样例。
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");
const TZ = "Asia/Shanghai";

await loadDotEnv(join(ROOT, ".env"));

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const FIXED_HOLIDAYS = {
  "01-01": "元旦",
  "02-14": "情人节",
  "03-08": "妇女节",
  "03-12": "植树节",
  "04-01": "愚人节",
  "05-01": "劳动节",
  "05-04": "青年节",
  "06-01": "儿童节",
  "07-01": "建党节",
  "08-01": "建军节",
  "09-10": "教师节",
  "10-01": "国庆节",
  "11-11": "双十一",
  "12-24": "平安夜",
  "12-25": "圣诞节",
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const now = shanghaiNow();
  const dateStr = process.env.FORCE_DATE?.trim() || formatDate(now);
  const ctx = buildDayContext(dateStr);

  console.log(`生成摸鱼日历：${dateStr}（${ctx.weekday}）`);

  let calendar;
  if (process.env.MOCK === "1" || !process.env.LLM_API_KEY) {
    if (!process.env.LLM_API_KEY && process.env.MOCK !== "1") {
      console.warn("未配置 LLM_API_KEY，改用 MOCK 样例数据");
    }
    calendar = mockCalendar(ctx);
  } else {
    calendar = await generateWithLlm(ctx);
  }

  calendar = normalizeCalendar(calendar, ctx);

  await mkdir(DATA_DIR, { recursive: true });
  const dayPath = join(DATA_DIR, `${dateStr}.json`);
  const latestPath = join(DATA_DIR, "latest.json");
  const payload = `${JSON.stringify(calendar, null, 2)}\n`;

  await writeFile(dayPath, payload, "utf8");
  await writeFile(latestPath, payload, "utf8");

  // 维护索引，方便前端做历史翻页
  const indexPath = join(DATA_DIR, "index.json");
  let index = [];
  try {
    index = JSON.parse(await readFile(indexPath, "utf8"));
    if (!Array.isArray(index)) index = [];
  } catch {
    index = [];
  }
  if (!index.includes(dateStr)) {
    index.push(dateStr);
    index.sort();
  }
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(`已写入 ${dayPath}`);
  console.log(`已写入 ${latestPath}`);
}

function shanghaiNow() {
  // 用格式化拿到上海时区的年月日，再构一个本地 Date（仅用于算 weekday / 月末）
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T12:00:00+08:00`);
}

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDayContext(dateStr) {
  const d = new Date(`${dateStr}T12:00:00+08:00`);
  const weekdayIndex = d.getDay();
  const weekday = WEEKDAYS[weekdayIndex];
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;

  let daysToWeekend;
  if (weekdayIndex === 0) daysToWeekend = 0;
  else if (weekdayIndex === 6) daysToWeekend = 0;
  else daysToWeekend = 6 - weekdayIndex;

  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysToPayday = Math.max(0, lastDay - d.getDate());

  const mmdd = dateStr.slice(5);
  const holiday = FIXED_HOLIDAYS[mmdd] || null;

  return {
    date: dateStr,
    weekday,
    weekdayIndex,
    isWeekend,
    daysToWeekend,
    daysToPayday,
    holiday,
    month: d.getMonth() + 1,
    day: d.getDate(),
    year: d.getFullYear(),
  };
}

function mockCalendar(ctx) {
  return {
    date: ctx.date,
    weekday: ctx.weekday,
    daysToWeekend: ctx.daysToWeekend,
    daysToPayday: ctx.daysToPayday,
    holiday: ctx.holiday,
    title: ctx.isWeekend ? "合法躺平日" : "今日宜适度摸鱼",
    subtitle: ctx.holiday
      ? `${ctx.holiday}快乐，记得体面地摸`
      : ctx.isWeekend
        ? "周末不属于工位"
        : `距离周末还有 ${ctx.daysToWeekend} 天`,
    quote: ctx.isWeekend
      ? "休息是为了更好地……继续休息。"
      : "工作是暂时的，摸鱼是永恒的。",
    mood: ctx.isWeekend ? "松弛" : "隐忍而快乐",
    suitable: ctx.isWeekend
      ? ["补觉", "刷剧", "散步", "不回工作消息"]
      : ["喝水", "站起来走走", "整理桌面", "假装认真看文档"],
    avoid: ctx.isWeekend
      ? ["自愿加班", "打开公司群"]
      : ["主动揽活", "会中第一个发言", "周五下午提需求"],
    tips: [
      "番茄钟之外也可以有「发呆钟」。",
      "邮件可以稍后再回，水杯应该现在就满。",
    ],
    generatedAt: new Date().toISOString(),
    source: "mock",
  };
}

async function generateWithLlm(ctx) {
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(
    /\/$/,
    "",
  );
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  const apiKey = process.env.LLM_API_KEY;

  const system = `你是「摸鱼人日历」撰稿人。风格：轻松、机智、温暖的打工人幽默，不阴阳怪气伤人，不涉及时政敏感与歧视。
只输出一个 JSON 对象，不要 markdown 代码块，不要其它说明。字段必须齐全：
{
  "title": "短标题，8字以内",
  "subtitle": "一句补充，20字以内",
  "quote": "一句今日金句",
  "mood": "今日心情词，2-6字",
  "suitable": ["宜做的事1","宜做的事2","宜做的事3","宜做的事4"],
  "avoid": ["忌做的事1","忌做的事2","忌做的事3"],
  "tips": ["小贴士1","小贴士2"]
}`;

  const user = `日期：${ctx.date}（${ctx.weekday}）
是否周末：${ctx.isWeekend ? "是" : "否"}
距离周末：${ctx.daysToWeekend} 天
距离月末发薪日（按月末计）：${ctx.daysToPayday} 天
固定节日：${ctx.holiday || "无"}
请据此写一份当日摸鱼人日历文案。`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM 请求失败 ${res.status}: ${text.slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 返回空内容");

  let parsed;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (e) {
    throw new Error(`LLM JSON 解析失败: ${e.message}\n原文: ${content.slice(0, 400)}`);
  }

  return {
    ...parsed,
    date: ctx.date,
    weekday: ctx.weekday,
    daysToWeekend: ctx.daysToWeekend,
    daysToPayday: ctx.daysToPayday,
    holiday: ctx.holiday,
    generatedAt: new Date().toISOString(),
    source: "llm",
    model,
  };
}

function stripCodeFence(text) {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1] : trimmed;
}

function normalizeCalendar(raw, ctx) {
  const asList = (v, fallback) => {
    if (Array.isArray(v) && v.length) return v.map(String).slice(0, 6);
    return fallback;
  };

  return {
    date: ctx.date,
    weekday: ctx.weekday,
    daysToWeekend: ctx.daysToWeekend,
    daysToPayday: ctx.daysToPayday,
    holiday: ctx.holiday,
    title: String(raw.title || "今日宜摸鱼").slice(0, 20),
    subtitle: String(raw.subtitle || `距离周末还有 ${ctx.daysToWeekend} 天`).slice(0, 40),
    quote: String(raw.quote || "工作是暂时的，摸鱼是永恒的。").slice(0, 80),
    mood: String(raw.mood || "平稳").slice(0, 12),
    suitable: asList(raw.suitable, ["喝水", "站起来", "深呼吸"]),
    avoid: asList(raw.avoid, ["主动加班", "内耗"]),
    tips: asList(raw.tips, ["记得眨眼，屏幕不会跑。"]),
    generatedAt: raw.generatedAt || new Date().toISOString(),
    source: raw.source || "llm",
    model: raw.model,
  };
}

async function loadDotEnv(path) {
  try {
    const text = await readFile(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // .env 可选
  }
}
