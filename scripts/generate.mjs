#!/usr/bin/env node
/**
 * 生成当日摸鱼人日历 JSON → public/data/YYYY-MM-DD.json + latest.json
 * 依赖环境变量：LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
 * MOCK=1 时跳过模型，写入本地样例。
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDayContext } from "./meta.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA_DIR = join(ROOT, "public", "data");
const TZ = "Asia/Shanghai";
const require = createRequire(import.meta.url);

await loadDotEnv(join(ROOT, ".env"));

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const now = shanghaiNow();
  const dateStr = process.env.FORCE_DATE?.trim() || formatDate(now);
  const lunarLib = loadLunarLib();
  const ctx = buildDayContext(dateStr, lunarLib);

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

function loadLunarLib() {
  try {
    return require("lunar-javascript");
  } catch {
    console.warn("未安装 lunar-javascript，农历/干支将留空（npm i lunar-javascript）");
    return {};
  }
}

function shanghaiNow() {
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

function mockCalendar(ctx) {
  return {
    status: ctx.isWeekend
      ? "周末到了，工位已进入休眠模式。手机静音、群聊免打扰，今天的 KPI 只有呼吸和快乐。"
      : "周一，是打工人集体「灵魂返厂检修」的日子。咖啡续命、眼神放空、鼠标乱点，键盘敲得震天响，文档里只有三个字：待补充。",
    slogan: "今天你摸鱼了吗？",
    bless: ctx.isWeekend
      ? "寄语：休息不是偷懒的延长线，是下周继续体面摸鱼的燃料。\n今天的目标只有一个——把闹钟设晚一点。"
      : "寄语：摸鱼不是偷懒，是给大脑留一块不被 KPI 占领的自留地。\n今天的目标只有一个——把「已读」变成「已摸」。",
    suitable: ctx.isWeekend
      ? [
          "宜补觉到自然醒，让生物钟和工位暂时分手",
          "宜把想看的片单刷掉两部，周末不加班剧情",
          "宜出门晒太阳，提醒自己不是盆栽",
        ]
      : [
          "宜把会议开成静音模式，摄像头对准天花板",
          "宜在工位假装沉思，实则研究午饭吃什么",
          "宜把「收到」打成「收到～」，用波浪号软化灵魂",
        ],
    avoid: ctx.isWeekend
      ? [
          "忌主动打开公司邮箱，假期侵入会传染",
          "忌在朋友圈晒加班，会被同事当成内卷先锋",
          "忌制定过于宏大的周计划，周一你会感谢现在的自己",
        ]
      : [
          "忌在群里第一个回复「我来」，你会被记住一辈子",
          "忌下午三点后接新需求，此时大脑已下班",
          "忌把摸鱼记录写进周报，领导会以为你在做副业",
        ],
    food: {
      staple: "番茄牛腩面",
      snack: "烤红薯",
      soup: "玉米排骨汤",
      dessert: "桂花酒酿圆子",
    },
    movies: [
      {
        title: "《办公空间》",
        year: 1999,
        blurb: "把「上班如上坟」拍成喜剧，摸鱼人的祖师爷级精神食粮。",
      },
      {
        title: "《白日梦想家》",
        year: 2013,
        blurb: "上班走神走成一场冰岛旅行，看完想立刻请假。",
      },
      {
        title: "《实习生》",
        year: 2015,
        blurb: "七十岁实习生入职互联网公司，治愈系职场童话。",
      },
      {
        title: "《穿普拉达的女王》",
        year: 2006,
        blurb: "提醒你：再忙也别忘了自己为什么出发（以及别接老板凌晨的电话）。",
      },
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

  const system = `你是「摸鱼人日历」撰稿人。风格对齐经典摸鱼日历：轻松、机智、温暖的打工人幽默，不阴阳怪气伤人，不涉及时政敏感与歧视。
只输出一个 JSON 对象，不要 markdown 代码块，不要其它说明。字段必须齐全且类型正确：
{
  "status": "今日状态，80-120字，像一段工位观察日记",
  "slogan": "一句口号，10字以内，可沿用「今天你摸鱼了吗？」或自创新句",
  "bless": "寄语两行，用 \\n 换行，每行一句，带一点安慰和笑点",
  "suitable": ["宜……（完整一句，15-28字）", "宜……", "宜……"],
  "avoid": ["忌……（完整一句，15-28字）", "忌……", "忌……"],
  "food": {
    "staple": "主食名",
    "snack": "小吃名",
    "soup": "汤名",
    "dessert": "点心名"
  },
  "movies": [
    { "title": "《影片名》", "year": 1999, "blurb": "一句话安利，20-40字" },
    { "title": "《影片名》", "year": 2013, "blurb": "……" },
    { "title": "《影片名》", "year": 2015, "blurb": "……" },
    { "title": "《影片名》", "year": 2006, "blurb": "……" }
  ]
}
要求：suitable/avoid 各 3 条；movies 必须 4 部，偏职场/松弛/喜剧；food 贴合季节与午饭场景。`;

  const user = `日期：${ctx.date}（${ctx.weekday}）
是否周末：${ctx.isWeekend ? "是" : "否"}
页眉信息：${ctx.yearMonth}${ctx.ganzhi ? ` · ${ctx.ganzhi}` : ""}
${ctx.headerLine || ""}
固定节日：${ctx.holiday || "无"}
距离周末：${ctx.daysToWeekend} 天（${ctx.weekendDate}）
下一节气：${ctx.solarTerm ? `${ctx.solarTerm.name}还有 ${ctx.solarTerm.days} 天` : "无"}
请写一份完整的当日摸鱼人日历文案（状态/口号寄语/宜忌/吃什么/片单）。倒计时与发薪由系统计算，你不必输出。`;

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

  const foodIn = raw.food && typeof raw.food === "object" ? raw.food : {};
  const moviesIn = Array.isArray(raw.movies) ? raw.movies : [];

  return {
    date: ctx.date,
    day: ctx.day,
    weekday: ctx.weekday,
    yearMonth: ctx.yearMonth,
    ganzhi: ctx.ganzhi,
    lunar: ctx.lunarText,
    zodiac: ctx.zodiac,
    solarTerm: ctx.solarTerm,
    headerLine: ctx.headerLine,
    holiday: ctx.holiday,
    daysToWeekend: ctx.daysToWeekend,
    status: String(raw.status || "").slice(0, 220) || mockCalendar(ctx).status,
    slogan: String(raw.slogan || "今天你摸鱼了吗？").slice(0, 24),
    bless: String(raw.bless || mockCalendar(ctx).bless).slice(0, 160),
    suitable: asList(raw.suitable, mockCalendar(ctx).suitable),
    avoid: asList(raw.avoid, mockCalendar(ctx).avoid),
    food: {
      staple: String(foodIn.staple || foodIn["主食"] || "番茄牛腩面").slice(0, 20),
      snack: String(foodIn.snack || foodIn["小吃"] || "烤红薯").slice(0, 20),
      soup: String(foodIn.soup || foodIn["汤"] || "玉米排骨汤").slice(0, 20),
      dessert: String(foodIn.dessert || foodIn["点心"] || "桂花酒酿圆子").slice(0, 20),
    },
    movies: normalizeMovies(moviesIn, mockCalendar(ctx).movies),
    countdowns: ctx.countdowns,
    paydays: ctx.paydays,
    paydayMonth: ctx.month,
    generatedAt: raw.generatedAt || new Date().toISOString(),
    source: raw.source || "llm",
    model: raw.model,
  };
}

function normalizeMovies(list, fallback) {
  const mapped = list
    .map((m) => ({
      title: String(m?.title || "").slice(0, 30),
      year: Number(m?.year) || null,
      blurb: String(m?.blurb || m?.desc || "").slice(0, 80),
    }))
    .filter((m) => m.title);
  while (mapped.length < 4 && fallback[mapped.length]) {
    mapped.push(fallback[mapped.length]);
  }
  return mapped.slice(0, 4);
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
