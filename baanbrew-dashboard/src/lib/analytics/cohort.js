// Lab 4.2 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.2A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.2 · Cohort retention รายเดือน
// cohort = เดือนแรกที่ลูกค้าสมาชิกซื้อ · retention[k] = สัดส่วนลูกค้าใน cohort ที่กลับมาซื้อในเดือนที่ k (k=0 คือเดือนแรก = 100%)

/** จำนวนเดือนจาก a ถึง b เช่น monthIndex("2025-11", "2026-02") = 3 */
export function monthIndex(a, b) {
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/**
 * @param rows  แถวยอดขาย (ไม่นับ customer_id ว่าง)
 * @param asOf  วันสุดท้ายของข้อมูล YYYY-MM-DD ใช้บอกว่าเดือนสุดท้ายข้อมูลไม่ครบหรือไม่
 * @returns {{ cohorts: {cohort, size, retention: number[]}[], lastMonth, lastMonthPartial, daysInLastMonth }}
 *   retention ยาวเท่าจำนวนเดือนที่สังเกตได้ของ cohort นั้น (ถึง lastMonth)
 */
export function computeCohorts(rows, asOf) {
  const lastMonth = asOf.slice(0, 7);

  // เดือนที่แต่ละสมาชิกซื้อ (Set = ซื้อกี่ครั้งในเดือนเดียวกันก็นับครั้งเดียว) · เดือน = 7 ตัวอักษรแรกของวันที่ ไม่ผ่าน Date
  const months = new Map();
  for (const x of rows) {
    const id = (x.customer_id ?? "").trim();
    if (!id) continue; // walk-in ไม่ใช่สมาชิก
    const m = x.date.slice(0, 7);
    if (m > lastMonth) continue; // เกินวันสุดท้ายของข้อมูล
    (months.get(id) ?? months.set(id, new Set()).get(id)).add(m);
  }

  // จัดสมาชิกเข้า cohort ตามเดือนแรกที่ซื้อ
  const byCohort = new Map();
  for (const set of months.values()) {
    const first = [...set].sort()[0];
    (byCohort.get(first) ?? byCohort.set(first, []).get(first)).push(set);
  }

  const cohorts = [...byCohort.keys()].sort().map((cohort) => {
    const sets = byCohort.get(cohort);
    const [y, mo] = cohort.split("-").map(Number);
    const observed = monthIndex(cohort, lastMonth) + 1; // จำนวนเดือนที่สังเกตได้ ถึง lastMonth
    const retention = Array.from({ length: observed }, (_, k) => {
      const d = new Date(Date.UTC(y, mo - 1 + k, 1)); // เดือนที่ k หลังจาก cohort (UTC ไม่เพี้ยน timezone)
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      return sets.filter((s) => s.has(ym)).length / sets.length;
    });
    return { cohort, size: sets.length, retention };
  });

  const [ly, lm] = lastMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(ly, lm, 0)).getUTCDate();
  const daysInLastMonth = Number(asOf.slice(8, 10));
  return { cohorts, lastMonth, lastMonthPartial: daysInLastMonth < daysInMonth, daysInLastMonth, daysInMonth };
}
