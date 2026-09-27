# RAISE Module 3 — Data Analytics & Visualization ด้วย AI Vibe Coding

งานของวิชา RAISE Module 3 กรณีศึกษาเครือร้านกาแฟสมมติ **"บ้านบรู"** (5 สาขาในกรุงเทพฯ ข้อมูล 1 เม.ย. 2025 – 20 ก.ย. 2026)

| โฟลเดอร์ | งาน | สถานะ |
|---|---|---|
| [`baanbrew-dashboard/`](baanbrew-dashboard/) | Lab 1 · Dashboard ยอดขาย (React + Vite + Tailwind v4 + Recharts + PapaParse) | ✅ |

## Lab 1 · baanbrew-dashboard

- KPI 4 ใบ: ยอดขายรวม, จำนวนบิล, ยอดเฉลี่ยต่อบิล, ลูกค้าสมาชิก (ไม่ซ้ำ)
- กราฟเส้นยอดขายรายวัน + ค่าเฉลี่ย 7 วัน, วันที่ภาษาไทยบนแกน X
- กราฟแท่งยอดขายแยกสาขา เรียงมาก → น้อย (มือถือเปลี่ยนเป็นแท่งแนวนอน)
- ตรรกะคำนวณทั้งหมดอยู่ที่ [`src/lib/metrics.js`](baanbrew-dashboard/src/lib/metrics.js)

### วิธีรัน

ต้องมี Node.js 20 ขึ้นไป

```bash
cd baanbrew-dashboard
npm install
npm run dev
```

ไฟล์ข้อมูล `sales.csv`, `products.csv`, `branches.csv` อยู่ใน `baanbrew-dashboard/public/` แล้ว (ข้อมูลสมมติของคอร์ส) — `sales.csv` ตรงกับไฟล์ต้นฉบับจากผู้สอนทุกไบต์

### ตรวจตัวเลข (Verify)

ตัวเลขทุกค่าเทียบกับ Pivot Table / การคำนวณอิสระแล้วตรงกัน กติกาข้อมูลที่ใช้:

- 1 แถว = 1 รายการสินค้า ไม่ใช่ 1 บิล · จำนวนบิล = จำนวน `order_id` ที่ไม่ซ้ำ
- ยอดขาย = `qty × unit_price` · ยอดเฉลี่ยต่อบิล = ยอดขาย ÷ จำนวนบิล
- `customer_id` ว่าง = ลูกค้าทั่วไป ไม่ใช่สมาชิก
- วันที่ = 10 ตัวอักษรแรกของ `datetime` (ไม่แปลงผ่าน UTC)
