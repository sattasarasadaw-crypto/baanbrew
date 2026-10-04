// Lab 3.2 + 3.3A · Dashboard ยอดขายแบบ real-time จาก Firestore พร้อมล็อกอินด้วย Google
// - ยังไม่ล็อกอิน → แสดงปุ่มเข้าสู่ระบบแทน Dashboard และ "ไม่เริ่ม onSnapshot" (ไม่เสียโควตาอ่านโดยเปล่าประโยชน์)
// - ฟัง collection "sales" ด้วย onSnapshot และ return unsubscribe ใน cleanup ของ useEffect
//   (ถ้าไม่ return: เปลี่ยนช่วงเวลาหรือออกจากหน้าแล้ว listener เก่ายังฟังต่อ → อ่านซ้ำเรื่อย ๆ กินโควตาและเกิด memory leak)
// - สูตรคำนวณทั้งหมดใช้จาก ../lib/metrics.js (เอกสารใน Firestore มีรูปแบบเดียวกับแถว CSV จึงส่งเข้า prepareRows ได้เลย)
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { db, auth, googleProvider } from "./firebase.js";
import { addDays, todayBangkok } from "./time.js";
import SaleForm from "./SaleForm.jsx";
import KpiCard from "../components/KpiCard.jsx";
import {
  computeKpis, dailyRevenue, formatBaht, formatBahtShort, formatHour, formatNumber, formatThaiDate,
  prepareRows, revenueByBranch, revenueByHour,
} from "../lib/metrics.js";

const MAIN = "#92400e"; // amber-800 สีหลักสีเดียวเหมือนทุกแท็บ
const GRID = "#e7e5e4";
const RANGES = [
  { id: "today", label: "วันนี้", days: 1 },
  { id: "7", label: "7 วัน", days: 7 },
  { id: "30", label: "30 วัน", days: 30 },
];
const HIGHLIGHT_MS = 4000;

const AUTH_ERRORS = {
  "auth/unauthorized-domain": "โดเมนนี้ยังไม่ได้รับอนุญาตให้ล็อกอิน เพิ่มโดเมนใน Firebase → Authentication → Settings → Authorized domains",
  "auth/operation-not-allowed": "ยังไม่ได้เปิดการล็อกอินด้วย Google ใน Firebase → Authentication → Sign-in method",
  "auth/popup-blocked": "เบราว์เซอร์บล็อกหน้าต่างล็อกอิน อนุญาต pop-up สำหรับเว็บนี้แล้วลองใหม่",
  "auth/popup-closed-by-user": "ปิดหน้าต่างล็อกอินก่อนเสร็จ ลองกดเข้าสู่ระบบอีกครั้ง",
};
const authMessage = (e) => AUTH_ERRORS[e.code] ?? `ล็อกอินไม่สำเร็จ: ${e.code ?? e.message}`;
const dataMessage = (e) =>
  e.code === "permission-denied" ? "Security Rules ไม่อนุญาตให้อ่านข้อมูล (ตรวจว่าล็อกอินแล้ว และ rules เปิดให้อ่านเมื่อล็อกอิน)"
  : e.code === "resource-exhausted" ? "ใช้โควตาฟรีของวันนี้หมดแล้ว รอรีเซ็ต หรือเลือกช่วงวันที่สั้นลง"
  : e.code === "failed-precondition" ? `Firestore ต้องการ index เพิ่ม: ${e.message}`
  : e.message ?? String(e);

export default function LiveTab() {
  const [user, setUser] = useState(undefined); // undefined = กำลังตรวจสถานะ · null = ยังไม่ล็อกอิน
  const [authError, setAuthError] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  if (user === undefined) return <p className="text-stone-500">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  if (user === null) {
    return (
      <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-sm ring-1 ring-amber-100">
        <h1 className="text-xl font-bold text-amber-800">ยอดขายสด</h1>
        <p className="mt-2 text-sm text-stone-600">ต้องเข้าสู่ระบบก่อนจึงจะดูและบันทึกยอดขายได้</p>
        <button
          onClick={() => { setAuthError(null); signInWithPopup(auth, googleProvider).catch((e) => setAuthError(authMessage(e))); }}
          className="mt-4 rounded-lg bg-amber-800 px-5 py-2.5 font-medium text-white">
          เข้าสู่ระบบด้วย Google
        </button>
        {authError && <p className="mt-3 text-sm text-red-700">❌ {authError}</p>}
      </div>
    );
  }
  return <Dashboard user={user} />;
}

function Dashboard({ user }) {
  const [range, setRange] = useState("7");
  const [branch, setBranch] = useState("all");
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reads, setReads] = useState(0);
  const [fresh, setFresh] = useState(() => new Set()); // id ของแถวที่เพิ่งเข้ามา (ไฮไลต์ 4 วินาที)
  const [products, setProducts] = useState([]);
  const timers = useRef([]);

  // เมนูโหลดครั้งเดียวด้วย getDocs (ข้อมูลแทบไม่เปลี่ยน ไม่ต้องฟังตลอด)
  useEffect(() => {
    getDocs(collection(db, "products"))
      .then((s) => setProducts(s.docs.map((d) => d.data()).sort((a, b) => a.product_id.localeCompare(b.product_id))))
      .catch((e) => setError(dataMessage(e)));
  }, []);

  // ฟังยอดขายตามช่วงเวลา: เปลี่ยนช่วง → ยกเลิกตัวฟังเก่า (cleanup) แล้วเริ่มตัวใหม่
  useEffect(() => {
    const today = todayBangkok();
    const days = RANGES.find((r) => r.id === range).days;
    const start = addDays(today, -(days - 1));
    const q = query(collection(db, "sales"), where("date", ">=", start), where("date", "<=", today), orderBy("date"));

    // ค่าเริ่มต้นของ loading/error/docs ตั้งไว้ตอนสร้าง state และรีเซ็ตใน chooseRange() ตอนผู้ใช้กดเปลี่ยนช่วง (ไม่ setState ตรง ๆ ใน effect)
    let firstSnapshot = true;
    const unsubscribe = onSnapshot(q,
      (snap) => {
        const changes = snap.docChanges();
        setReads((n) => n + changes.length); // นับทุกเอกสารที่ส่งมา = ปริมาณที่กินโควตาอ่าน
        if (!firstSnapshot) {
          const added = changes.filter((c) => c.type === "added").map((c) => c.doc.id);
          if (added.length) {
            setFresh((s) => new Set([...s, ...added]));
            timers.current.push(setTimeout(() => setFresh((s) => new Set([...s].filter((id) => !added.includes(id)))), HIGHLIGHT_MS));
          }
        }
        firstSnapshot = false;
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => { setError(dataMessage(e)); setLoading(false); },
    );
    return unsubscribe; // ห้ามลืม: ไม่งั้นตัวฟังเก่าค้างอยู่
  }, [range]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // เปลี่ยนช่วงเวลา: ล้างข้อมูลเก่าและแสดงสถานะกำลังโหลดทันที แล้ว useEffect ด้านบนจะเริ่มฟังช่วงใหม่
  const chooseRange = (id) => {
    if (id === range) return;
    setLoading(true);
    setError(null);
    setDocs([]);
    setRange(id);
  };

  const shown = useMemo(() => (branch === "all" ? docs : docs.filter((d) => d.branch === branch)), [docs, branch]);
  const rows = useMemo(() => prepareRows(shown), [shown]);
  const kpis = useMemo(() => computeKpis(rows), [rows]);
  const daily = useMemo(() => dailyRevenue(rows), [rows]);
  const hourly = useMemo(() => revenueByHour(rows), [rows]);
  const byBranch = useMemo(() => revenueByBranch(rows), [rows]);
  const names = useMemo(() => Object.fromEntries(products.map((p) => [p.product_id, p.product_name])), [products]);
  const recent = useMemo(() => [...shown].sort((a, b) => b.datetime.localeCompare(a.datetime)).slice(0, 8), [shown]);
  const includesToday = daily.some((d) => d.date === todayBangkok());

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-amber-800">ยอดขายสด</h1>
            <p className="text-xs text-stone-500">อ่านเอกสารไปแล้ว {formatNumber(reads)} (นับทุกครั้งที่ฟัง ตัวเลขนี้คือสิ่งที่กินโควตาอ่านรายวันของ Firestore)</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {user.photoURL && <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />}
            <span className="max-w-40 truncate text-stone-700">{user.displayName ?? user.email}</span>
            <button onClick={() => signOut(auth)} className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-700">ออกจากระบบ</button>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => chooseRange(r.id)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-medium ${range === r.id ? "bg-amber-800 text-white" : "bg-white text-stone-600 ring-1 ring-amber-100"}`}>
              {r.label}
            </button>
          ))}
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm">
            <option value="all">ทุกสาขา</option>
            {["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"].map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">❌ {error}</p>}
        {loading && !error && <p className="mt-4 text-stone-500">กำลังโหลดข้อมูล…</p>}
        {!loading && !error && rows.length === 0 && (
          <p className="mt-4 rounded-lg bg-white p-4 text-stone-600 ring-1 ring-amber-100">
            ยังไม่มียอดขายในช่วงนี้ (ข้อมูลที่นำเข้าจบที่เมื่อวาน ลองเลือก 7 วัน หรือบันทึกยอดขายจากฟอร์ม)
          </p>
        )}

        {rows.length > 0 && (
          <>
            <section className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
              <KpiCard label="ยอดขายรวม" value={formatBaht(kpis.totalRevenue)} />
              <KpiCard label="จำนวนบิล" value={formatNumber(kpis.billCount)} />
              <KpiCard label="ยอดเฉลี่ยต่อบิล" value={formatBaht(kpis.avgPerBill, 2)} />
              <KpiCard label="ลูกค้าสมาชิก" value={formatNumber(kpis.memberCount)} />
            </section>

            <Card title={range === "today" ? "ยอดขายรายชั่วโมง (วันนี้)" : "ยอดขายรายวัน"}>
              {includesToday && range !== "today" && (
                <p className="-mt-1 mb-2 text-xs text-stone-500">จุดสุดท้ายคือวันนี้ ซึ่งยังไม่ครบวัน จึงต่ำกว่าวันอื่นเป็นปกติ ไม่ได้แปลว่ายอดตก</p>
              )}
              <ResponsiveContainer width="100%" height={240}>
                {range === "today" ? (
                  <BarChart data={hourly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="hour" tickFormatter={(h) => String(h)} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatBahtShort} width={52} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [formatBaht(v), "ยอดขาย"]} labelFormatter={(h) => `เวลา ${formatHour(h)}–${formatHour(h + 1)}`} cursor={{ fill: "#fef3c7" }} />
                    <Bar dataKey="revenue" fill={MAIN} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                ) : (
                  <LineChart data={daily} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatThaiDate} minTickGap={32} tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, "auto"]} tickFormatter={formatBahtShort} width={52} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [formatBaht(v), "ยอดขาย"]} labelFormatter={(d) => `วันที่ ${formatThaiDate(d)}`} />
                    <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={daily.length <= 8} isAnimationActive={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Card>

            <Card title="ยอดขายแยกสาขา">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byBranch} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" tickFormatter={formatBahtShort} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="branch" width={84} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => [formatBaht(v), "ยอดขาย"]} cursor={{ fill: "#fef3c7" }} />
                  <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="รายการล่าสุด">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-stone-500">
                    <tr><th className="pb-2 font-medium">เวลา</th><th className="pb-2 font-medium">สาขา</th><th className="pb-2 font-medium">เมนู</th><th className="pb-2 text-right font-medium">ยอด</th></tr>
                  </thead>
                  <tbody>
                    {recent.map((d) => (
                      <tr key={d.id} className={`border-t border-stone-100 transition-colors ${fresh.has(d.id) ? "bg-amber-100" : ""}`}>
                        <td className="py-1.5 pr-2 whitespace-nowrap text-stone-600">{formatThaiDate(d.date)} {d.datetime.slice(11, 16)}</td>
                        <td className="py-1.5 pr-2">{d.branch}</td>
                        <td className="py-1.5 pr-2">{names[d.product_id] ?? d.product_id} × {d.qty}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatBaht(d.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-16 lg:self-start">
        {products.length > 0
          ? <SaleForm products={products} uid={user.uid} />
          : <p className="rounded-xl bg-white p-4 text-sm text-stone-500 ring-1 ring-amber-100">กำลังโหลดรายการเมนู…</p>}
      </aside>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <section className="mt-4 min-w-0 rounded-xl bg-white p-3 shadow-sm ring-1 ring-amber-100 sm:p-4">
      <h2 className="mb-3 font-semibold text-stone-700">{title}</h2>
      {children}
    </section>
  );
}
