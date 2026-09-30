# RAISE Module 3 — Data Analytics & Visualization ด้วย AI Vibe Coding

งานของวิชา RAISE Module 3 กรณีศึกษาเครือร้านกาแฟสมมติ **"บ้านบรู"** (5 สาขาในกรุงเทพฯ ข้อมูล 1 เม.ย. 2025 – 20 ก.ย. 2026)

| โฟลเดอร์ | งาน | สถานะ |
|---|---|---|
| [`baanbrew-dashboard/`](baanbrew-dashboard/) | Lab 1 · Dashboard ยอดขาย (React + Vite + Tailwind v4 + Recharts + PapaParse) | ✅ |
| [`homework-01-bills-by-hour.md`](homework-01-bills-by-hour.md) | การบ้านคาบ 1 · จำนวนบิลตามชั่วโมงแยกสาขา + ข้อสังเกต 5 ข้อ (กราฟอยู่ใน dashboard) | ✅ |
| [`lab2.1-colab/`](lab2.1-colab/) | Lab 2.1 · Data profiling + ทำความสะอาด `sales_raw.csv` → `sales_clean.csv` (Colab notebook + log) | ✅ |
| [`baanbrew-dashboard/src/lab2/`](baanbrew-dashboard/src/lab2/) | Lab 2.2 · ซ่อมกราฟแย่ 5 แบบ (`FixedCharts.jsx`) + ใบงาน [`LAB2_WORKSHEET.md`](baanbrew-dashboard/LAB2_WORKSHEET.md) | ✅ |
| [`lab2-customers-colab/`](lab2-customers-colab/) | Data profiling ข้อมูลลูกค้า `customers.csv` → `customers_clean.csv` (Colab notebook, ตัดข้อมูลส่วนบุคคลตาม PDPA) + แท็บ "ลูกค้าสมาชิก" บน dashboard | ✅ |

🌐 **เว็บที่ deploy:** https://baanbrew1002.vercel.app/ · แท็บ ภาพรวม / [ลูกค้าสมาชิก](https://baanbrew1002.vercel.app/#customers) / [Lab 2.2 · ซ่อมกราฟ](https://baanbrew1002.vercel.app/#lab2)

## Lab 1 · baanbrew-dashboard

- KPI 4 ใบ: ยอดขายรวม, จำนวนบิล, ยอดเฉลี่ยต่อบิล, ลูกค้าสมาชิก (ไม่ซ้ำ)
- กราฟเส้นยอดขายรายวัน + ค่าเฉลี่ย 7 วัน, วันที่ภาษาไทยบนแกน X
- กราฟแท่งยอดขายแยกสาขา เรียงมาก → น้อย (มือถือเปลี่ยนเป็นแท่งแนวนอน)
- จำนวนบิลตามชั่วโมง (ทุกสาขา) + บิลเฉลี่ยต่อวันตามชั่วโมงแยก 5 สาขา (สเกลเดียวกัน, แท่งเข้ม = ชั่วโมงพีค)
- แท็บ **ลูกค้าสมาชิก**: KPI สมาชิก, สมาชิกใหม่รายเดือน (เดือนที่ข้อมูลไม่ครบเป็นสีอ่อน), ช่วงอายุ/เพศ, สาขาประจำ + % ที่ซื้อที่สาขาประจำ · อ่าน `public/customers.csv` ที่ไม่มี nickname/phone
- ข้อมูลยอดขายใน `public/sales.csv` คือ `sales_clean.csv` จาก Lab 2.1
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
