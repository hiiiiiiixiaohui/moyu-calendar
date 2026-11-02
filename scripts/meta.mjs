/**
 * 确定性元数据：周末/节日/发薪倒计时、星座、节气、农历。
 */

const WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

/** 公历节日表（含农历节日对应公历日） */
const HOLIDAYS_BY_YEAR = {
  2025: [
    ["元旦", "2025-01-01"],
    ["除夕", "2025-01-28"],
    ["春节", "2025-01-29"],
    ["清明节", "2025-04-04"],
    ["劳动节", "2025-05-01"],
    ["端午节", "2025-05-31"],
    ["中秋节", "2025-10-06"],
    ["国庆节", "2025-10-01"],
  ],
  2026: [
    ["元旦", "2026-01-01"],
    ["除夕", "2026-02-16"],
    ["春节", "2026-02-17"],
    ["清明节", "2026-04-05"],
    ["劳动节", "2026-05-01"],
    ["端午节", "2026-06-19"],
    ["中秋节", "2026-09-25"],
    ["国庆节", "2026-10-01"],
  ],
  2027: [
    ["元旦", "2027-01-01"],
    ["除夕", "2027-02-05"],
    ["春节", "2027-02-06"],
    ["清明节", "2027-04-05"],
    ["劳动节", "2027-05-01"],
    ["端午节", "2027-06-09"],
    ["中秋节", "2027-09-15"],
    ["国庆节", "2027-10-01"],
  ],
  2028: [
    ["元旦", "2028-01-01"],
    ["除夕", "2028-01-25"],
    ["春节", "2028-01-26"],
    ["清明节", "2028-04-04"],
    ["劳动节", "2028-05-01"],
    ["端午节", "2028-05-28"],
    ["中秋节", "2028-10-03"],
    ["国庆节", "2028-10-01"],
  ],
};

const SOLAR_TERMS = [
  [2, 4, "立春"],
  [2, 19, "雨水"],
  [3, 6, "惊蛰"],
  [3, 21, "春分"],
  [4, 5, "清明"],
  [4, 20, "谷雨"],
  [5, 6, "立夏"],
  [5, 21, "小满"],
  [6, 6, "芒种"],
  [6, 21, "夏至"],
  [7, 7, "小暑"],
  [7, 23, "大暑"],
  [8, 8, "立秋"],
  [8, 23, "处暑"],
  [9, 8, "白露"],
  [9, 23, "秋分"],
  [10, 8, "寒露"],
  [10, 23, "霜降"],
  [11, 7, "立冬"],
  [11, 22, "小雪"],
  [12, 7, "大雪"],
  [12, 22, "冬至"],
  [1, 6, "小寒"],
  [1, 20, "大寒"],
];

const ZODIAC = [
  { name: "摩羯座", from: [12, 22], to: [1, 19] },
  { name: "水瓶座", from: [1, 20], to: [2, 18] },
  { name: "双鱼座", from: [2, 19], to: [3, 20] },
  { name: "白羊座", from: [3, 21], to: [4, 19] },
  { name: "金牛座", from: [4, 20], to: [5, 20] },
  { name: "双子座", from: [5, 21], to: [6, 21] },
  { name: "巨蟹座", from: [6, 22], to: [7, 22] },
  { name: "狮子座", from: [7, 23], to: [8, 22] },
  { name: "处女座", from: [8, 23], to: [9, 22] },
  { name: "天秤座", from: [9, 23], to: [10, 23] },
  { name: "天蝎座", from: [10, 24], to: [11, 22] },
  { name: "射手座", from: [11, 23], to: [12, 21] },
];

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

/**
 * @param {string} dateStr YYYY-MM-DD
 * @param {{ Solar?: any }} [lunarLib]
 */
export function buildDayContext(dateStr, lunarLib = {}) {
  const d = parseDate(dateStr);
  const weekdayIndex = d.getUTCDay();
  const weekday = WEEKDAYS[weekdayIndex];
  const isWeekend = weekdayIndex === 0 || weekdayIndex === 6;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();

  const weekend = nextWeekend(d);
  const countdowns = buildHolidayCountdowns(d, weekend);
  const paydays = buildPaydays(d);
  const zodiac = getZodiac(month, day);
  const solarTerm = nextSolarTerm(d);
  const lunar = getLunarInfo(year, month, day, lunarLib);
  const holiday = FIXED_HOLIDAYS[dateStr.slice(5)] || null;

  return {
    date: dateStr,
    day,
    month,
    year,
    weekday,
    weekdayIndex,
    isWeekend,
    daysToWeekend: weekend.days,
    weekendDate: weekend.date,
    yearMonth: `${year} 年 ${month} 月`,
    ganzhi: lunar.ganzhi,
    lunarText: lunar.text,
    zodiac,
    solarTerm,
    holiday,
    countdowns,
    paydays,
    headerLine: [
      lunar.text,
      zodiac,
      solarTerm ? `距${solarTerm.name} ${solarTerm.days} 天` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function parseDate(dateStr) {
  const [y, m, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 4, 0, 0));
}

function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function diffDays(from, to) {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86400000);
}

function nextWeekend(d) {
  const clone = new Date(d);
  const day = clone.getUTCDay();
  let add;
  let name;
  if (day === 6) {
    add = 0;
    name = "周末（周六）";
  } else if (day === 0) {
    add = 0;
    name = "周末（周日）";
  } else {
    add = 6 - day;
    name = "周末（周六）";
  }
  clone.setUTCDate(clone.getUTCDate() + add);
  return { name, date: formatDate(clone), dateObj: clone, days: add };
}

function buildHolidayCountdowns(d, weekend) {
  const byName = new Map();
  byName.set(weekend.name, {
    name: weekend.name,
    days: weekend.days,
    date: weekend.date,
    hot: true,
  });

  const years = [d.getUTCFullYear(), d.getUTCFullYear() + 1];
  for (const y of years) {
    for (const [name, date] of HOLIDAYS_BY_YEAR[y] || []) {
      const days = diffDays(d, parseDate(date));
      if (days < 0) continue;
      const prev = byName.get(name);
      if (!prev || days < prev.days) {
        byName.set(name, {
          name,
          days,
          date,
          hot: days > 0 && days <= 7,
        });
      }
    }
  }

  return [...byName.values()].sort((a, b) => a.days - b.days).slice(0, 10);
}

function buildPaydays(d) {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const today = d.getUTCDate();
  const marks = [...new Set([5, 10, 15, 20, 25, lastDay])];

  return marks.map((mark) => {
    let targetYear = year;
    let targetMonth = month;
    let targetDay = Math.min(mark, lastDay);

    if (targetDay < today) {
      targetMonth = month + 1;
      if (targetMonth > 11) {
        targetMonth = 0;
        targetYear += 1;
      }
      const nextLast = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      targetDay = Math.min(mark, nextLast);
    }

    const target = new Date(Date.UTC(targetYear, targetMonth, targetDay));
    return {
      label: `${targetDay} 号发薪`,
      days: diffDays(d, target),
      date: formatDate(target),
    };
  });
}

function getZodiac(month, day) {
  for (const z of ZODIAC) {
    const [fm, fd] = z.from;
    const [tm, td] = z.to;
    if (fm <= tm) {
      if ((month === fm && day >= fd) || (month === tm && day <= td) || (month > fm && month < tm)) {
        return z.name;
      }
    } else if ((month === fm && day >= fd) || (month === tm && day <= td) || month > fm || month < tm) {
      return z.name;
    }
  }
  return "摩羯座";
}

function nextSolarTerm(d) {
  const year = d.getUTCFullYear();
  const candidates = [];
  for (const y of [year, year + 1]) {
    for (const [m, day, name] of SOLAR_TERMS) {
      candidates.push({
        name,
        dateObj: new Date(Date.UTC(y, m - 1, day)),
        date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      });
    }
  }
  candidates.sort((a, b) => a.dateObj - b.dateObj);
  for (const c of candidates) {
    const days = diffDays(d, c.dateObj);
    if (days >= 0) return { name: c.name, days, date: c.date };
  }
  return null;
}

function getLunarInfo(year, month, day, lunarLib) {
  try {
    const Solar = lunarLib?.Solar;
    if (!Solar) return { text: null, ganzhi: null };
    const solar = Solar.fromYmd(year, month, day);
    const lunar = solar.getLunar();
    return {
      text: `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
      ganzhi: `${lunar.getYearInGanZhi()}${lunar.getYearShengXiao()}年 ${lunar.getMonthInGanZhi()}月 ${lunar.getDayInGanZhi()}日`,
    };
  } catch {
    return { text: null, ganzhi: null };
  }
}
