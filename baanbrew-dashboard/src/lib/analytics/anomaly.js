// Lab 4.5 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.5A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.5 · หาวันที่ยอดขายผิดปกติ
// เทียบกับ "ค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน" ไม่ใช่ค่าเฉลี่ย 28 วัน
// เพราะสาขาออฟฟิศกับห้างขายวันธรรมดาและเสาร์-อาทิตย์ต่างกันมาก
import { addDays } from "../../lab3/time.js";
import { toSeries } from "./daily.js";

export const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};

/**
 * คะแนนความผิดปกติ = ln((จริง + SMOOTH) / (คาดหวัง + SMOOTH))
 * SMOOTH กันไม่ให้วันยอดน้อย ๆ (เช่น 50 บาท เทียบ 100 บาท) ดูผิดปกติเกินจริง
 * @param daily    [{ date, branch, revenue }] จาก dailyByBranch()
 * @param holidays { "YYYY-MM-DD": "ชื่อวันหยุด" } วันหยุดจะไม่ถูกจัดอันดับ แต่ติดป้ายไว้
 * @returns ทุกวันที่คำนวณได้ เรียงจากผิดปกติมากไปน้อย:
 *   { date, branch, actual, expected, change (สัดส่วน เช่น -0.9 = ต่ำกว่าปกติ 90%), score, holiday }
 */
export function scoreAnomalies(daily, holidays = {}, { weeks = 8, minWeeks = 4, smooth = 1000 } = {}) {
  const out = [];
  for (const branch of new Set(daily.map((d) => d.branch))) {
    // อนุกรมต่อเนื่องของสาขานี้เริ่มจากวันแรกที่มีข้อมูล (ไม่นับวันก่อนเปิดสาขาเป็นศูนย์) วันที่ไม่มียอดเติม 0
    const series = toSeries(daily, branch);
    const revenue = new Map(series.map((s) => [s.date, s.revenue]));
    for (const { date, revenue: actual } of series) {
      // ค่าอ้างอิง = วันเดียวกันของสัปดาห์ใน `weeks` สัปดาห์ก่อนหน้า (ถอยทีละ 7 วัน เท่าที่มีข้อมูล)
      const history = [];
      for (let k = 1; k <= weeks; k++) {
        const v = revenue.get(addDays(date, -7 * k));
        if (v !== undefined) history.push(v);
      }
      if (history.length < minWeeks) continue; // ข้อมูลย้อนหลังไม่พอ ไม่ให้คะแนน
      const expected = median(history); // median ไม่ถูกลากโดยวันผิดปกติในอดีต (ต่างจากค่าเฉลี่ย)
      if (expected <= 0) continue; // ไม่มีค่าอ้างอิงให้เทียบเป็นสัดส่วน (สาขาไม่ขายวันนั้นมาตลอด)
      out.push({
        date, branch, actual, expected,
        change: actual / expected - 1, // เช่น -0.9 = ต่ำกว่าปกติ 90%
        score: Math.log((actual + smooth) / (expected + smooth)),
        holiday: holidays[date] ?? null,
      });
    }
  }
  // ผิดปกติมากสุดก่อน (ทั้งสูงและต่ำกว่าปกติ) · คะแนนเท่ากันเรียงตามวันที่แล้วสาขาให้ผลคงที่
  return out.sort((a, b) => Math.abs(b.score) - Math.abs(a.score) || a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch));
}

/** อันดับวันผิดปกติที่ควรตรวจสอบ (ไม่รวมวันหยุด) */
export function topAnomalies(daily, holidays = {}, n = 15, opts) {
  return scoreAnomalies(daily, holidays, opts).filter((a) => !a.holiday).slice(0, n);
}
