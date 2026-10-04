// Lab 3.2C · ฟอร์มบันทึกยอดขาย (วางไว้คอลัมน์ขวาของ LiveTab)
// - ตรวจฟอร์มด้วย validateSaleForm และสร้างเอกสารด้วย buildSale จาก ./saleModel.js
// - ราคามาจากเมนูเสมอ (ผู้ใช้แก้ไม่ได้) · uid คือผู้ใช้ที่ล็อกอิน (Lab 3.3A)
// - บันทึกด้วย setDoc + serverTimestamp(): created_at เป็นเวลาของเซิร์ฟเวอร์ ปลอมจากเครื่องไม่ได้ (Security Rules ตรวจ created_at == request.time)
import { useMemo, useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { BRANCHES, PAYMENTS, MAX_QTY, validateSaleForm, buildSale } from "./saleModel.js";

const EMPTY = { branch: "", product_id: "", qty: "1", payment_method: "", customer_id: "" };
const baht = (n) => "฿" + n.toLocaleString("th-TH");

export default function SaleForm({ products, uid }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ type: "idle" }); // idle | saving | ok | error

  const product = useMemo(() => products.find((p) => p.product_id === form.product_id), [products, form.product_id]);
  const qtyOk = /^\d+$/.test(form.qty.trim()) && Number(form.qty) >= 1 && Number(form.qty) <= MAX_QTY;
  const total = product && qtyOk ? Number(form.qty) * Number(product.price) : null;

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined })); // เคลียร์ error ของช่องที่กำลังแก้
    if (status.type !== "saving") setStatus({ type: "idle" });
  };

  async function submit(e) {
    e.preventDefault();
    const found = validateSaleForm(form, products);
    setErrors(found);
    if (Object.keys(found).length) return;

    const { id, data } = buildSale(form, product, { uid });
    setStatus({ type: "saving" });
    try {
      await setDoc(doc(db, "sales", id), { ...data, created_at: serverTimestamp() });
      setStatus({ type: "ok", message: `บันทึกแล้ว ${data.order_id} · ${baht(data.revenue)}` });
      setForm((f) => ({ ...EMPTY, branch: f.branch, payment_method: f.payment_method })); // จำสาขาและวิธีชำระเงินไว้ บันทึกรายการถัดไปได้เร็ว
    } catch (err) {
      console.error("บันทึกยอดขายไม่สำเร็จ", err.code, data); // data ไว้ให้เทียบกับ firestore.rules (ดู PROMPTS_LAB3.md)
      setStatus({
        type: "error",
        message: err.code === "permission-denied"
          ? "ถูกปฏิเสธโดย Security Rules — เอกสารที่ส่งไปไม่ตรงเงื่อนไขใน firestore.rules (ดูรายละเอียดใน Console ของเบราว์เซอร์)"
          : err.code === "unavailable" ? "เชื่อมต่อ Firestore ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่"
          : `บันทึกไม่สำเร็จ: ${err.code ?? err.message}`,
      });
    }
  }

  const saving = status.type === "saving";
  const field = "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} noValidate className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-amber-100">
      <h2 className="font-semibold text-stone-700">บันทึกยอดขาย</h2>
      <p className="mb-3 text-xs text-stone-500">บันทึกแล้วตัวเลขในหน้านี้ (และหน้าต่างอื่นที่เปิดอยู่) จะขยับเอง</p>

      <Row label="สาขา" error={errors.branch}>
        <select value={form.branch} onChange={set("branch")} className={field}>
          <option value="">— เลือกสาขา —</option>
          {BRANCHES.map((b) => <option key={b}>{b}</option>)}
        </select>
      </Row>
      <Row label="เมนู" error={errors.product_id}>
        <select value={form.product_id} onChange={set("product_id")} className={field}>
          <option value="">— เลือกเมนู —</option>
          {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name} · {baht(Number(p.price))}</option>)}
        </select>
      </Row>
      <Row label={`จำนวน (1–${MAX_QTY})`} error={errors.qty}>
        <input value={form.qty} onChange={set("qty")} inputMode="numeric" className={field} />
      </Row>
      <Row label="วิธีชำระเงิน" error={errors.payment_method}>
        <select value={form.payment_method} onChange={set("payment_method")} className={field}>
          <option value="">— เลือกวิธีชำระเงิน —</option>
          {PAYMENTS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Row>
      <Row label="รหัสสมาชิก (ไม่บังคับ)" error={errors.customer_id}>
        <input value={form.customer_id} onChange={set("customer_id")} placeholder="เช่น C01234" className={field} />
      </Row>

      <div className="mt-3 flex items-baseline justify-between rounded-lg bg-amber-50 px-3 py-2">
        <span className="text-sm text-stone-600">ยอดรวม</span>
        <span className="text-xl font-bold tabular-nums text-amber-900">{total === null ? "—" : baht(total)}</span>
      </div>

      <button type="submit" disabled={saving}
              className="mt-3 w-full rounded-lg bg-amber-800 px-4 py-2.5 font-medium text-white disabled:opacity-60">
        {saving ? "กำลังบันทึก…" : "บันทึกยอดขาย"}
      </button>
      {status.type === "ok" && <p className="mt-2 text-sm text-emerald-700">✅ {status.message}</p>}
      {status.type === "error" && <p className="mt-2 text-sm text-red-700">❌ {status.message}</p>}
    </form>
  );
}

function Row({ label, error, children }) {
  return (
    <label className="mt-2 block text-sm text-stone-700">
      {label}
      {children}
      {error && <span className="mt-1 block text-xs text-red-700">{error}</span>}
    </label>
  );
}
