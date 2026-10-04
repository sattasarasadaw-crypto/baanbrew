// การ์ดตัวเลขสำคัญ (KPI) ใช้ร่วมกันทุกแท็บ — ชุดเดียวกับที่เคยอยู่ใน App.jsx ย้ายมาไว้ที่นี่เพื่อให้หน้า "สด" ใช้ซ้ำได้
export default function KpiCard({ label, value, note }) {
  return (
    <div className="min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <div className="text-xs text-stone-500 sm:text-sm">{label}</div>
      {/* มือถือตัวเล็กลงนิด (text-lg) เพื่อให้ตัวเลขยาว ๆ ไม่ล้นการ์ดบนจอแคบ 320px */}
      <div className="mt-1 text-lg font-bold tabular-nums text-amber-900 sm:text-2xl">{value}</div>
      {note && <div className="mt-1 text-xs text-stone-500">{note}</div>}
    </div>
  )
}
