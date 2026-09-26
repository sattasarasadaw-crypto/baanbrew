// ตรรกะคำนวณทั้งหมดของ Dashboard อยู่ในไฟล์นี้ไฟล์เดียว (ไม่มีโค้ด React)
// กติกาข้อมูล sales.csv:
//   - 1 แถว = 1 รายการสินค้า, บิลหนึ่ง (order_id เดียวกัน) มีได้หลายแถว
//   - ยอดขาย = qty × unit_price
//   - customer_id ว่าง = ลูกค้าทั่วไป ไม่ใช่สมาชิก

// แปลงแถวดิบจาก PapaParse (ทุกค่าเป็นข้อความ) ให้พร้อมคำนวณ
// - qty, unit_price แปลงเป็น Number ก่อน ไม่งั้น "2" * "65" ยังได้ แต่ "2" + "65" = "265"
// - date ใช้ 10 ตัวอักษรแรกของ datetime ("2025-04-01") ไม่ผ่าน new Date()
//   เพราะ toISOString() จะแปลงเป็นเวลา UTC ทำให้บิลก่อน 07:00 เลื่อนไปเป็นเมื่อวาน
// - revenue คำนวณเก็บไว้ต่อแถวเลย จะได้ไม่ต้องคูณซ้ำทุกฟังก์ชัน
export function prepareRows(rawRows) {
  return rawRows.map((r) => {
    const qty = Number(r.qty)
    const unitPrice = Number(r.unit_price)
    return {
      orderId: r.order_id,
      date: r.datetime.slice(0, 10),
      branch: r.branch,
      qty,
      unitPrice,
      revenue: qty * unitPrice,
      customerId: r.customer_id?.trim() || null,
    }
  })
}

// KPI 4 ตัว
// - totalRevenue: ผลรวม revenue ทุกแถว
// - billCount: จำนวน order_id ที่ไม่ซ้ำ (นับด้วย Set) ไม่ใช่จำนวนแถว
// - avgPerBill: ยอดขายรวม ÷ จำนวนบิล (ไม่ใช่ ÷ จำนวนแถว)
// - memberCount: จำนวน customer_id ที่ไม่ซ้ำ โดยข้ามแถวที่ customer_id ว่าง
export function computeKpis(rows) {
  let totalRevenue = 0
  const bills = new Set()
  const members = new Set()
  for (const r of rows) {
    totalRevenue += r.revenue
    bills.add(r.orderId)
    if (r.customerId) members.add(r.customerId)
  }
  const billCount = bills.size
  return {
    totalRevenue,
    billCount,
    avgPerBill: billCount ? totalRevenue / billCount : 0,
    memberCount: members.size,
  }
}

// ยอดขายรายวัน: รวม revenue ตาม date แล้วเรียงตามวันที่เก่า → ใหม่
// (วันที่รูปแบบ YYYY-MM-DD เรียงแบบข้อความได้ถูกต้องอยู่แล้ว)
export function dailyRevenue(rows) {
  const byDate = new Map()
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.revenue)
  return [...byDate]
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ค่าเฉลี่ยเคลื่อนที่ย้อนหลัง N วัน (ค่าเริ่มต้น 7): เพิ่มฟิลด์ avg ให้แต่ละวัน
// = ค่าเฉลี่ยยอดขายของวันนั้นกับ N−1 วันก่อนหน้า
// - N−1 วันแรกยังมีข้อมูลไม่ครบ N วัน จึงให้ avg = null (กราฟจะเริ่มลากเส้นตั้งแต่วันที่ N)
// - นับตามลำดับแถว จึงต้องมียอดครบทุกวันติดกัน ข้อมูลบ้านบรูมีครบ 538 วัน ไม่มีวันขาด
export function movingAverage(daily, windowDays = 7) {
  let sum = 0
  return daily.map((d, i) => {
    sum += d.revenue
    if (i >= windowDays) sum -= daily[i - windowDays].revenue
    return { ...d, avg: i >= windowDays - 1 ? sum / windowDays : null }
  })
}

// ยอดขายแยกสาขา: รวม revenue ตาม branch แล้วเรียงจากมากไปน้อย
export function revenueByBranch(rows) {
  const byBranch = new Map()
  for (const r of rows) byBranch.set(r.branch, (byBranch.get(r.branch) ?? 0) + r.revenue)
  return [...byBranch]
    .map(([branch, revenue]) => ({ branch, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
}

// รูปแบบตัวเลข: มีจุลภาค เช่น 34,791
const numberFmt = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })
export const formatNumber = (n) => numberFmt.format(n)

// รูปแบบเงินแบบสั้นสำหรับแกนกราฟบนจอมือถือ: 20000 → "฿20K", 1050000 → "฿1.05M"
// (ใช้แค่ที่แกน ตัวเลขจริงใน tooltip และ KPI ยังเต็มด้วย formatBaht)
// หลักล้านใช้ทศนิยม 2 ตำแหน่ง ไม่งั้น 1,050,000 จะปัดเป็น "1.1M" ซึ่งไม่ตรงค่าจริง
export function formatBahtShort(n) {
  if (Math.abs(n) >= 1e6) return `฿${+(n / 1e6).toFixed(2)}M`
  if (Math.abs(n) >= 1e3) return `฿${+(n / 1e3).toFixed(1)}K`
  return `฿${n}`
}

// วันที่ภาษาไทยแบบย่อ: "2025-04-01" → "1 เม.ย. 68"
// - แยกข้อความตรง ๆ ไม่ผ่าน new Date() จึงไม่มีปัญหาเขตเวลาทำให้วันเลื่อน
// - ปี พ.ศ. = ค.ศ. + 543 แล้วเอา 2 หลักท้าย (2025 → 2568 → "68")
const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
export function formatThaiDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const beYear = String((y + 543) % 100).padStart(2, '0')
  return `${d} ${THAI_MONTHS[m - 1]} ${beYear}`
}

// รูปแบบเงิน: "฿" นำหน้า + จุลภาค เช่น ฿4,466,821 หรือ ฿128.39 (ถ้ากำหนดทศนิยม)
export const formatBaht = (n, decimals = 0) =>
  '฿' +
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)
