// Lab 4.4B · test ของ toWeeks (ไฟล์ใหม่ ไม่ได้แก้ forecast.test.js ของชุดต้นฉบับ)
import { describe, it, expect } from "vitest";
import { toWeeks, mape, backtest } from "./forecast.js";
import { addDays } from "../../lab3/time.js";

// จันทร์ 5 ม.ค. 2026 เป็นต้นไป วันละ 100, 200, 300, ... ตามลำดับวัน
const days = (start, n, f = (i) => (i + 1) * 100) =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(start, i), revenue: f(i) }));

describe("toWeeks", () => {
  it("รวมเป็นสัปดาห์จันทร์–อาทิตย์ และบอกวันจันทร์ของสัปดาห์", () => {
    const w = toWeeks(days("2026-01-05", 14), ["revenue"]);
    expect(w.map((x) => x.weekStart)).toEqual(["2026-01-05", "2026-01-12"]);
    expect(w[0].revenue).toBe(100 + 200 + 300 + 400 + 500 + 600 + 700);
    expect(w[1].revenue).toBe(800 + 900 + 1000 + 1100 + 1200 + 1300 + 1400);
  });
  it("วันอาทิตย์นับเป็นสัปดาห์ของวันจันทร์ก่อนหน้า (ไม่ใช่สัปดาห์ถัดไป)", () => {
    // จันทร์ 5 → จันทร์ 12 ม.ค. (8 วัน): อาทิตย์ 11 ต้องอยู่ในสัปดาห์ที่เริ่ม 5 ม.ค. ส่วนจันทร์ 12 ม.ค. วันเดียวถูกตัดทิ้ง
    const w = toWeeks(days("2026-01-05", 8), ["revenue"]);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ weekStart: "2026-01-05", days: 7, revenue: 2800 });
  });
  it("ตัดสัปดาห์ที่ไม่ครบ 7 วันทิ้ง (ต้นและท้ายช่วง)", () => {
    // พุธ 7 ม.ค. → อังคาร 20 ม.ค. = 14 วัน แต่ไม่ได้ตรงสัปดาห์: มีสัปดาห์เต็มแค่ 12–18 ม.ค.
    const w = toWeeks(days("2026-01-07", 14), ["revenue"]);
    expect(w.map((x) => x.weekStart)).toEqual(["2026-01-12"]);
  });
  it("รวมหลายฟิลด์พร้อมกัน", () => {
    const rows = days("2026-01-05", 7).map((d) => ({ date: d.date, a: 1, b: 2 }));
    expect(toWeeks(rows, ["a", "b"])[0]).toMatchObject({ a: 7, b: 14, days: 7 });
  });
});

describe("MAPE รายสัปดาห์ ใช้ mape เดิม", () => {
  it("ร้านวันธรรมดา/เสาร์-อาทิตย์คงที่: รายสัปดาห์ไม่คลาดเคลื่อน", () => {
    const office = Array.from({ length: 70 }, (_, i) => {
      const date = addDays("2026-01-05", i);
      const d = new Date(date + "T00:00:00Z").getUTCDay();
      return { date, revenue: d === 0 || d === 6 ? 200 : 1000 };
    });
    const bt = backtest(office, 28);
    const weeks = toWeeks(bt.test, ["actual", "seasonal"]);
    expect(weeks).toHaveLength(4);
    expect(mape(weeks.map((w) => w.actual), weeks.map((w) => w.seasonal))).toBeCloseTo(0);
  });
});
