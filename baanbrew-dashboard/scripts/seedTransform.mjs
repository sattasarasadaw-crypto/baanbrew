// Lab 3.1 · แปลงแถวจาก sales.csv (ผลลัพธ์ Lab 2.1) เป็นเอกสาร Firestore
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.1 ใน PROMPTS_LAB3.md) จนกว่า npm test จะผ่านทุกข้อ
// scripts/seed.mjs เรียกใช้ฟังก์ชันเหล่านี้ ไม่ต้องแก้ seed.mjs
//
// หลักสำคัญของไฟล์นี้:
// - วันที่ทุกตัวคำนวณจากข้อความ YYYY-MM-DD ด้วย addDays/daysBetween (time.js) ไม่ผ่าน new Date().toISOString()
//   เพราะจะกลายเป็นเวลา UTC แล้ววันเลื่อน (กับดักเดียวกับ Lab 1)
// - ตรวจข้อมูลทุกแถวก่อนเขียน ถ้ายังไม่สะอาดให้ throw ทันที ดีกว่าเขียนข้อมูลผิดลงฐานข้อมูลจริง
import { addDays, daysBetween } from "../src/lab3/time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];

const DATE_LEN = 10; // "YYYY-MM-DD"
// 20YY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ. และเวลาไทยเท่านั้น (ปี พ.ศ. 25xx หรือ DD/MM/YYYY ไม่ผ่าน)
const ISO_TH = /^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\+07:00$/;
const POSITIVE_INT = /^[1-9]\d*$/;
const POSITIVE_NUMBER = /^(?:[1-9]\d*|0)(?:\.\d+)?$/;

const dateOf = (iso) => iso.slice(0, DATE_LEN);

/**
 * เลือกเฉพาะ N วันล่าสุดของข้อมูล นับจากวันล่าสุดในไฟล์ (ไม่ใช่วันนี้) รวมวันสุดท้ายด้วย
 * วิธีคิด: end = วันที่มากสุดในไฟล์, start = end − (N − 1) วัน แล้วเก็บแถวที่ date >= start
 * (วันที่รูป YYYY-MM-DD เทียบเป็นข้อความได้ตรงกับเทียบเป็นวันที่)
 * @returns {{ rows: object[], start: string, end: string }}  start/end เป็น YYYY-MM-DD
 */
export function selectLastDays(rows, days) {
  if (!rows.length) throw new Error("ไม่มีข้อมูลให้เลือก");
  if (!Number.isInteger(days) || days < 1) throw new Error(`จำนวนวันต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป (ได้ ${days})`);
  let end = dateOf(rows[0].datetime);
  for (const r of rows) {
    const d = dateOf(r.datetime);
    if (d > end) end = d;
  }
  const start = addDays(end, -(days - 1));
  return { rows: rows.filter((r) => dateOf(r.datetime) >= start), start, end };
}

/**
 * จำนวนวันที่ต้องเลื่อน ให้วันล่าสุดของข้อมูลกลายเป็น "เมื่อวาน" ของ today · ห้ามติดลบ
 * วิธีคิด: เป้าหมาย = เมื่อวานของ today แล้วนับว่าห่างจากวันล่าสุดของข้อมูลกี่วัน
 * ถ้าข้อมูลใหม่กว่าเป้าหมายอยู่แล้ว ไม่เลื่อนถอยหลัง (คืน 0)
 */
export function computeShift(lastDataDate, today) {
  return Math.max(0, daysBetween(lastDataDate, addDays(today, -1)));
}

/** เลื่อนวันที่ใน datetime ("2026-09-20T16:05:09+07:00") ไป days วัน โดยคงเวลาและ +07:00 */
export function shiftDateTime(iso, days) {
  if (days === 0) return iso;
  return addDays(dateOf(iso), days) + iso.slice(DATE_LEN); // ส่วนเวลาและ +07:00 ใช้ของเดิมทั้งก้อน
}

/**
 * แปลง 1 แถว CSV (ทุกค่าเป็นข้อความ) เป็น { id, data }
 * id = order_id + "-" + product_id
 * data มีฟิลด์: order_id, datetime, date, hour, branch, product_id, qty, unit_price, revenue,
 *               customer_id (ว่าง = null), payment_method, channel, source = "import"
 * ต้อง throw Error ถ้าข้อมูลยังไม่สะอาด: qty ไม่ใช่จำนวนเต็มบวก, ราคาไม่ใช่ตัวเลขบวก,
 * สาขาไม่อยู่ใน BRANCHES, datetime ไม่ใช่ 20YY-MM-DDTHH:MM:SS+07:00
 *
 * ทำไม document id = order_id-product_id: 1 บิลมีหลายแถว (หลายเมนู) จึงใช้ order_id อย่างเดียวไม่ได้ (ชนกัน)
 * แต่คู่ order_id + product_id ไม่ซ้ำกัน และคงที่ทุกครั้งที่รัน → รัน seed ซ้ำแล้วเขียนทับเอกสารเดิม ไม่เกิดข้อมูลซ้ำ
 *
 * ทำไม customer_id ว่างต้องเป็น null: "" คือค่าที่มีอยู่จริง (สตริงว่าง) ส่วน null คือ "ไม่มีค่า" = ลูกค้าทั่วไป
 * ถ้าเก็บ "" จะกรองด้วย where("customer_id", "==", null) ไม่เจอ และ Security Rules ที่ตรวจว่า
 * "เป็น null หรือรูปแบบ C+5 หลัก" จะปฏิเสธ
 */
export function toSaleDoc(row, shiftDays = 0) {
  const where = `${row.order_id ?? "?"}-${row.product_id ?? "?"}`;
  const fail = (msg) => { throw new Error(`แถว ${where}: ${msg}`); };

  const orderId = (row.order_id ?? "").trim();
  const productId = (row.product_id ?? "").trim();
  if (!orderId) fail("order_id ว่าง");
  if (!productId) fail("product_id ว่าง");

  const qtyText = (row.qty ?? "").trim();
  if (!POSITIVE_INT.test(qtyText)) fail(`qty ต้องเป็นจำนวนเต็มบวก (ได้ "${row.qty}")`);
  const priceText = (row.unit_price ?? "").trim();
  if (!POSITIVE_NUMBER.test(priceText) || Number(priceText) <= 0) fail(`unit_price ต้องเป็นตัวเลขมากกว่า 0 (ได้ "${row.unit_price}")`);
  if (!BRANCHES.includes(row.branch)) fail(`สาขา "${row.branch}" ไม่อยู่ใน 5 สาขามาตรฐาน`);
  const datetimeText = (row.datetime ?? "").trim();
  if (!ISO_TH.test(datetimeText)) fail(`datetime ต้องเป็น 20YY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ. (ได้ "${row.datetime}")`);

  const qty = Number(qtyText);
  const unitPrice = Number(priceText);
  const datetime = shiftDateTime(datetimeText, shiftDays);
  const customerId = (row.customer_id ?? "").trim();

  return {
    id: `${orderId}-${productId}`,
    data: {
      order_id: orderId,
      datetime,
      date: dateOf(datetime),
      hour: Number(datetime.slice(11, 13)), // ชั่วโมงตามเวลาไทยจากข้อความโดยตรง ไม่แปลงเป็น UTC
      branch: row.branch,
      product_id: productId,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      customer_id: customerId === "" ? null : customerId,
      payment_method: row.payment_method,
      channel: row.channel,
      source: "import",
    },
  };
}

/** สรุป: { docs, bills (นับ order_id ไม่ซ้ำ), revenue, byBranch: {สาขา: ยอด}, start, end } */
export function summarize(docs) {
  const bills = new Set();
  const byBranch = {};
  let revenue = 0;
  let start = null;
  let end = null;
  for (const { data } of docs) {
    bills.add(data.order_id); // นับบิลจาก order_id ไม่ใช่จำนวนเอกสาร (1 บิลมีหลายรายการ)
    revenue += data.revenue;
    byBranch[data.branch] = (byBranch[data.branch] ?? 0) + data.revenue;
    if (start === null || data.date < start) start = data.date;
    if (end === null || data.date > end) end = data.date;
  }
  return { docs: docs.length, bills: bills.size, revenue, byBranch, start, end };
}
