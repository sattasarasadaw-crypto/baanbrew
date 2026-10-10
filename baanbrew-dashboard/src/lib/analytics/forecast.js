// Lab 4.4 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.4A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.4 · พยากรณ์ยอดขายแบบอธิบายได้ และวัดความแม่นด้วยการย้อนทดสอบ (backtest)
import { addDays } from "../../lab3/time.js";

const dow = (ymd) => new Date(ymd + "T00:00:00Z").getUTCDay(); // 0 = อาทิตย์

/** ค่าเฉลี่ยยอดขายวันเดียวกันของสัปดาห์ K ครั้งล่าสุด (ฤดูกาลรายสัปดาห์) */
export function seasonalForecast(series, horizon, K = 8) {
  if (!series.length) return [];
  // แยกยอดตามวันในสัปดาห์ (ตามลำดับเวลา) แล้วเฉลี่ย K ค่าสุดท้ายของแต่ละวัน
  const byDow = Array.from({ length: 7 }, () => []);
  for (const s of series) byDow[dow(s.date)].push(s.revenue);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  // ถ้าบางวันในสัปดาห์ไม่เคยมีข้อมูล (ซีรีส์สั้นกว่า 7 วัน) ใช้ค่าเฉลี่ยของข้อมูลที่มีแทน
  const fallback = mean(series.slice(-K * 7).map((s) => s.revenue));
  const avg = byDow.map((xs) => (xs.length ? mean(xs.slice(-K)) : fallback));
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => {
    const date = addDays(last, i + 1);
    return { date, forecast: avg[dow(date)] };
  });
}

/** ค่าเฉลี่ย K วันล่าสุด เส้นตรง (ตัวเปรียบเทียบที่ไม่สนวันในสัปดาห์) */
export function flatForecast(series, horizon, K = 28) {
  const recent = series.slice(-K);
  const avg = recent.reduce((a, s) => a + s.revenue, 0) / recent.length;
  const last = series[series.length - 1].date;
  return Array.from({ length: horizon }, (_, i) => ({ date: addDays(last, i + 1), forecast: avg }));
}

/**
 * Lab 4.4B · รวมรายวันเป็นรายสัปดาห์ (จันทร์–อาทิตย์) เฉพาะ "สัปดาห์ที่มีครบ 7 วัน"
 * @param rows  [{ date, ...ตัวเลข }]  @param keys ชื่อฟิลด์ตัวเลขที่ต้องรวม เช่น ["actual", "seasonal"]
 * @returns [{ weekStart (วันจันทร์), days: 7, ...ผลรวมของแต่ละ key }] เรียงตามเวลา
 */
export function toWeeks(rows, keys) {
  const weeks = new Map();
  for (const r of rows) {
    const weekStart = addDays(r.date, -((dow(r.date) + 6) % 7)); // dow: 0 = อาทิตย์ → ถอยไปจันทร์
    const w = weeks.get(weekStart) ?? { weekStart, days: 0, ...Object.fromEntries(keys.map((k) => [k, 0])) };
    w.days += 1;
    for (const k of keys) w[k] += r[k];
    weeks.set(weekStart, w);
  }
  return [...weeks.values()].filter((w) => w.days === 7).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/** Mean Absolute Percentage Error (%) · ข้ามวันที่ยอดจริงเป็น 0 เพราะหารไม่ได้ */
export function mape(actual, forecast) {
  let sum = 0;
  let n = 0;
  actual.forEach((a, i) => {
    if (a === 0) return; // หารด้วยศูนย์ไม่ได้ ข้ามวันนั้น
    sum += Math.abs(a - forecast[i]) / Math.abs(a);
    n += 1;
  });
  return n ? (sum / n) * 100 : NaN; // ไม่มีวันที่วัดได้เลย = ไม่นิยาม (ไม่แกล้งให้เป็น 0%)
}

/**
 * ย้อนทดสอบ: ซ่อน horizon วันสุดท้าย พยากรณ์จากข้อมูลก่อนหน้า แล้วเทียบกับของจริง
 * band = ±1.28 × ส่วนเบี่ยงเบนมาตรฐานของ % ความคลาดเคลื่อน (ช่วงประมาณ 80%)
 */
export function backtest(series, horizon = 28, K = 8) {
  if (series.length <= horizon) throw new Error(`ข้อมูลไม่พอย้อนทดสอบ: มี ${series.length} วัน ต้องมากกว่า ${horizon} วัน`);
  // ทำเหมือนเราอยู่เมื่อ horizon วันก่อน: ใช้เฉพาะข้อมูลก่อนหน้า (train) ห้ามแอบเห็นของจริง (test)
  const train = series.slice(0, -horizon);
  const actualRows = series.slice(-horizon);
  const seasonal = seasonalForecast(train, horizon, K);
  const flat = flatForecast(train, horizon);
  const actual = actualRows.map((s) => s.revenue);
  const test = actualRows.map((s, i) => ({ date: s.date, actual: s.revenue, seasonal: seasonal[i].forecast, flat: flat[i].forecast }));

  // % ความคลาดเคลื่อนแบบมีเครื่องหมาย เทียบกับค่าพยากรณ์ (ตรงกับที่หน้าจอใช้: forecast × (1 ± band))
  const errs = test.filter((t) => t.seasonal > 0).map((t) => (t.actual - t.seasonal) / t.seasonal);
  const m = errs.reduce((a, b) => a + b, 0) / (errs.length || 1);
  const sd = errs.length > 1 ? Math.sqrt(errs.reduce((a, e) => a + (e - m) ** 2, 0) / (errs.length - 1)) : 0;

  return {
    test,
    mapeSeasonal: mape(actual, seasonal.map((f) => f.forecast)),
    mapeFlat: mape(actual, flat.map((f) => f.forecast)),
    band: 1.28 * sd, // ±1.28 SD ≈ ช่วง 80% ถ้า % ความคลาดเคลื่อนกระจายแบบปกติ
  };
}
