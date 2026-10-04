// Lab 3.2 · ตรวจฟอร์มและสร้างเอกสารยอดขายใหม่
// ใช้ AI เขียนฟังก์ชันในไฟล์นี้ (Prompt 3.2A) จนกว่า npm test จะผ่านทุกข้อ
// เอกสารที่ได้ต้องมีโครงสร้างเดียวกับข้อมูลที่ import ใน Lab 3.1 เพื่อให้ metrics.js จาก Lab 1 ใช้ต่อได้
import { nowBangkokISO } from "./time.js";

export const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
export const PAYMENTS = ["QR พร้อมเพย์", "บัตรเครดิต", "เงินสด", "LINE MAN", "Grab"];
export const MAX_QTY = 20;

const DELIVERY = ["LINE MAN", "Grab"];
const MEMBER_ID = /^C\d{5}$/i; // รับตัวพิมพ์เล็กด้วย แล้วแปลงเป็นพิมพ์ใหญ่ตอนบันทึก
const WHOLE_NUMBER = /^\d+$/;
const ID_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 36 ตัว สำหรับท้ายเลขบิล

/**
 * ตรวจฟอร์ม { branch, product_id, qty, payment_method, customer_id } (ค่าเป็นข้อความจาก input)
 * คืน {} ถ้าถูกต้อง หรือ { ชื่อฟิลด์: ข้อความภาษาไทย } ถ้าผิด
 *
 * ตรวจฝั่งหน้าเว็บเพื่อให้ผู้ใช้เห็นข้อผิดพลาดทันที แต่ไม่ใช่ด่านป้องกันจริง
 * ด่านจริงคือ Security Rules (Lab 3.3) เพราะใครก็ข้ามหน้าเว็บแล้วยิงตรงเข้า Firestore ได้
 */
export function validateSaleForm(form, products) {
  const errors = {};
  if (!BRANCHES.includes(form.branch)) errors.branch = "กรุณาเลือกสาขา";
  if (!(products ?? []).some((p) => p.product_id === form.product_id)) errors.product_id = "กรุณาเลือกเมนูที่มีอยู่ในรายการ";

  const qtyText = String(form.qty ?? "").trim();
  if (!WHOLE_NUMBER.test(qtyText) || Number(qtyText) < 1 || Number(qtyText) > MAX_QTY) {
    errors.qty = `จำนวนต้องเป็นจำนวนเต็ม 1–${MAX_QTY}`;
  }

  if (!PAYMENTS.includes(form.payment_method)) errors.payment_method = "กรุณาเลือกวิธีชำระเงิน";

  const customer = String(form.customer_id ?? "").trim();
  if (customer !== "" && !MEMBER_ID.test(customer)) errors.customer_id = "รหัสสมาชิกต้องเป็นตัว C ตามด้วยตัวเลข 5 หลัก เช่น C01234 (เว้นว่างได้)";
  return errors;
}

/**
 * เลขบิลจากเวลาไทย รูปแบบ WEB-YYYYMMDD-HHMMSS-XXXX (XXXX = ตัวเลข/อักษรพิมพ์ใหญ่สุ่ม 4 ตัว)
 * ขึ้นต้นด้วย WEB- จึงไม่ชนกับเลขบิลที่ import (ORD…) และอ่านออกทันทีว่าบันทึกจากหน้าเว็บ
 */
export function makeOrderId(now = new Date(), rand = Math.random) {
  const iso = nowBangkokISO(now); // 2026-09-27T03:30:05+07:00
  const day = iso.slice(0, 10).replaceAll("-", "");
  const time = iso.slice(11, 19).replaceAll(":", "");
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ID_CHARS[Math.min(ID_CHARS.length - 1, Math.floor(rand() * ID_CHARS.length))];
  return `WEB-${day}-${time}-${suffix}`;
}

/**
 * สร้าง { id, data } จากฟอร์มที่ผ่านการตรวจแล้ว
 * - ราคามาจาก product.price เสมอ · revenue = qty × ราคา · ตัวเลขทุกตัวเป็น number
 * - datetime/date/hour เป็นเวลาไทย (ใช้ nowBangkokISO)
 * - channel = "เดลิเวอรี" ถ้าจ่ายด้วย LINE MAN หรือ Grab ไม่งั้น "หน้าร้าน"
 * - source = "web", created_by = uid · ยังไม่ต้องใส่ created_at (ใส่ตอนบันทึกด้วย serverTimestamp())
 *
 * ราคาต้องมาจากเมนูเสมอ ไม่รับจากฟอร์ม เพราะผู้ใช้แก้ราคาเองไม่ได้ (Security Rules จะเทียบกับ products อีกชั้น)
 */
export function buildSale(form, product, { uid, now = new Date(), rand = Math.random }) {
  const orderId = makeOrderId(now, rand);
  const datetime = nowBangkokISO(now);
  const qty = Number(String(form.qty).trim());
  const unitPrice = Number(product.price);
  const customer = String(form.customer_id ?? "").trim().toUpperCase();
  return {
    id: `${orderId}-${product.product_id}`,
    data: {
      order_id: orderId,
      datetime,
      date: datetime.slice(0, 10),
      hour: Number(datetime.slice(11, 13)),
      branch: form.branch,
      product_id: product.product_id,
      qty,
      unit_price: unitPrice,
      revenue: qty * unitPrice,
      customer_id: customer === "" ? null : customer,
      payment_method: form.payment_method,
      channel: DELIVERY.includes(form.payment_method) ? "เดลิเวอรี" : "หน้าร้าน",
      source: "web",
      created_by: uid,
    },
  };
}
