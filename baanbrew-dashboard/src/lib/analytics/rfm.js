// Lab 4.1 · ใช้ Claude Code เขียนฟังก์ชันที่ยังว่าง (Prompt 4.1A ใน PROMPTS_LAB4.md) จนกว่า npm test จะผ่าน · ห้ามแก้ไฟล์ test
// Lab 4.1 · RFM: แบ่งกลุ่มลูกค้าสมาชิกด้วย Recency, Frequency, Monetary
// rows = ผลจาก prepareRows() (มี order_id, date, revenue, customer_id)
import { daysBetween } from "../../lab3/time.js";

/**
 * คะแนน 1–5 ตามตำแหน่งเปอร์เซ็นไทล์ (ค่ามาก = คะแนนสูง)
 * ค่าที่เท่ากันต้องได้คะแนนเท่ากันเสมอ: score = 1 + floor(5 × จำนวนค่าที่ "น้อยกว่า" / n)
 */
export function percentileScores(values) {
  const n = values.length;
  // จำนวนค่าที่ "น้อยกว่า" แต่ละค่า: เรียงแล้วจดตำแหน่งแรกที่ค่านั้นปรากฏ
  // ค่าที่เท่ากันจึงได้จำนวนเท่ากัน → คะแนนเท่ากัน (ไม่แบ่งคนที่พฤติกรรมเหมือนกันไปคนละกลุ่ม)
  const sorted = [...values].sort((a, b) => a - b);
  const less = new Map();
  sorted.forEach((v, i) => { if (i === 0 || v !== sorted[i - 1]) less.set(v, i); });
  return values.map((v) => 1 + Math.floor((5 * less.get(v)) / n)); // ลำดับผลลัพธ์ตรงกับ values
}

/** กติกาตั้งชื่อกลุ่ม ตรวจจากบนลงล่าง ข้อแรกที่ตรงคือคำตอบ */
export function segmentOf(r, f) {
  if (r >= 4 && f >= 4) return "Champions";
  if (r >= 3 && f >= 4) return "Loyal";
  if (r >= 4 && f <= 2) return "New";
  if (r <= 2 && f >= 3) return "At Risk";
  if (r <= 2) return "Lost";
  return "Need Attention";
}

export const SEGMENTS = [
  { id: "Champions", th: "ลูกค้าชั้นยอด", action: "ให้สิทธิพิเศษ ชวนลองเมนูใหม่ก่อนใคร" },
  { id: "Loyal", th: "ลูกค้าประจำ", action: "สะสมแต้ม/ขยับขึ้นเป็นชั้นยอด" },
  { id: "New", th: "ลูกค้าใหม่", action: "คูปองครั้งที่ 2 ภายใน 14 วัน" },
  { id: "Need Attention", th: "ต้องดูแล", action: "โปรฯ ตามเมนูที่เคยซื้อ" },
  { id: "At Risk", th: "เสี่ยงหาย", action: "ดึงกลับด่วน: เคยซื้อบ่อยแต่หายไปนาน" },
  { id: "Lost", th: "หายไปแล้ว", action: "ใช้งบน้อย ส่งข้อความครั้งเดียว" },
];

/**
 * @param rows   แถวยอดขาย (ไม่นับแถวที่ customer_id ว่าง)
 * @param asOf   วันที่วิเคราะห์ YYYY-MM-DD (ใช้วันล่าสุดของข้อมูล ไม่ใช่วันนี้)
 * @returns {{ customers: object[], segments: object[], asOf: string }}
 *   customers: { id, R (วันที่ไม่ได้มา), F (จำนวนบิล), M (ยอดซื้อรวม), r, f, m, segment }
 *   segments:  { segment, customers, revenue, revenueShare, customerShare } เรียงตาม SEGMENTS
 */
export function computeRfm(rows, asOf) {
  // รวมต่อลูกค้า: บิล = order_id ที่ไม่ซ้ำ (1 บิลมีได้หลายแถว), ยอด = ผลรวม revenue, ครั้งล่าสุด = date มากสุด
  const by = new Map();
  for (const x of rows) {
    const id = (x.customer_id ?? "").trim();
    if (!id) continue; // walk-in ไม่ใช่สมาชิก
    const c = by.get(id) ?? { id, orders: new Set(), M: 0, last: "" };
    c.orders.add(x.order_id);
    c.M += x.revenue;
    if (x.date > c.last) c.last = x.date;
    by.set(id, c);
  }
  const list = [...by.values()].sort((a, b) => a.id.localeCompare(b.id));
  const R = list.map((c) => daysBetween(c.last, asOf)); // นับจากวันสุดท้ายของข้อมูล ไม่ใช่วันนี้
  const F = list.map((c) => c.orders.size);
  const M = list.map((c) => c.M);
  // R ยิ่งน้อยยิ่งดี จึงกลับเครื่องหมายก่อนให้คะแนน (5 = มาล่าสุด)
  const r = percentileScores(R.map((v) => -v));
  const f = percentileScores(F);
  const m = percentileScores(M);
  const customers = list.map((c, i) => ({
    id: c.id, R: R[i], F: F[i], M: M[i], r: r[i], f: f[i], m: m[i], segment: segmentOf(r[i], f[i]),
  }));

  const totalRevenue = M.reduce((a, b) => a + b, 0);
  const segments = SEGMENTS.map(({ id }) => {
    const members = customers.filter((c) => c.segment === id);
    const revenue = members.reduce((a, c) => a + c.M, 0);
    return {
      segment: id,
      customers: members.length,
      revenue,
      revenueShare: totalRevenue ? revenue / totalRevenue : 0,
      customerShare: customers.length ? members.length / customers.length : 0,
    };
  });
  return { customers, segments, asOf };
}
