// Lab 4.4–4.5 · พยากรณ์และวันผิดปกติ
// คำนวณในเบราว์เซอร์จาก analytics/daily (ยอดรายวันแยกสาขา ~2,700 แถว) จึงเปลี่ยนสาขาได้ทันทีโดยไม่อ่าน Firestore เพิ่ม
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { AnalyticsShell, Card, Pending, Insight, MAIN, GREEN, MUTED, INK, thaiDay } from "./ui.jsx";
import { useAnalytics } from "./useAnalytics.js";
import { toSeries } from "../lib/analytics/daily.js";
import { seasonalForecast, backtest, toWeeks, mape } from "../lib/analytics/forecast.js";
import { addDays } from "../lab3/time.js";
import { scoreAnomalies } from "../lib/analytics/anomaly.js";
import { fmtBaht, fmtShortBaht } from "../lib/metrics.js";

const BRANCHES = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"];
const HORIZON = 28;
const shortDay = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("th-TH", { day: "numeric", month: "short" });
const tryRun = (f) => { try { return { value: f() }; } catch (e) { return { error: e.message }; } };

function ForecastCard({ daily }) {
  const [branch, setBranch] = useState(null);
  const [view, setView] = useState("day"); // Lab 4.4B: "day" รายวัน · "week" รายสัปดาห์ (จันทร์–อาทิตย์)
  const result = useMemo(() => tryRun(() => {
    const series = toSeries(daily, branch);
    const bt = backtest(series, HORIZON);
    const fc = seasonalForecast(series, HORIZON);
    const recent = series.slice(-56);
    const last = recent[recent.length - 1];
    const chart = [
      ...recent.map((s) => ({ date: s.date, actual: s.revenue })),
      ...fc.map((f) => ({ date: f.date, forecast: f.forecast, band: [f.forecast * (1 - bt.band), f.forecast * (1 + bt.band)] })),
    ];
    chart[recent.length - 1] = { ...chart[recent.length - 1], forecast: last.revenue }; // ต่อเส้นให้ไม่ขาด
    const next7 = fc.slice(0, 7).reduce((s, f) => s + f.forecast, 0);

    // รายสัปดาห์: รวมเฉพาะสัปดาห์ที่มีครบ 7 วัน แล้ววัด MAPE ด้วยฟังก์ชัน mape เดิม
    const testW = toWeeks(bt.test, ["actual", "seasonal", "flat"]);
    const actualW = toWeeks(series.slice(-63), ["revenue"]).slice(-8);
    const fcW = toWeeks(fc, ["forecast"]);
    const week = {
      n: testW.length,
      mapeSeasonal: mape(testW.map((w) => w.actual), testW.map((w) => w.seasonal)),
      mapeFlat: mape(testW.map((w) => w.actual), testW.map((w) => w.flat)),
      next: fcW[0]?.forecast ?? null,
      lastDate: actualW.at(-1)?.weekStart,
      chart: [
        ...actualW.map((w) => ({ date: w.weekStart, actual: w.revenue })),
        ...fcW.map((w) => ({ date: w.weekStart, forecast: w.forecast })),
      ],
    };
    if (actualW.length) week.chart[actualW.length - 1] = { ...week.chart[actualW.length - 1], forecast: actualW.at(-1).revenue };
    return { bt, chart, next7, lastDate: last.date, week };
  }), [daily, branch]);

  const r = result.value;
  const weekly = view === "week" && r?.week.n > 0;
  return (
    <Card title="พยากรณ์ยอดขาย 28 วัน" sub="ค่าเฉลี่ยวันเดียวกันของสัปดาห์ 8 สัปดาห์ล่าสุด · แถบ = ช่วงที่คาดว่าครอบคลุมราว 80% ของวัน"
          right={<div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap justify-end gap-1">
              {[null, ...BRANCHES].map((b) => (
                <button key={b ?? "all"} onClick={() => setBranch(b)}
                        className={`rounded-lg px-2.5 py-1 text-sm ${branch === b ? "bg-stone-900 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{b ?? "รวม"}</button>
              ))}
            </div>
            {/* Lab 4.4B: สลับมุมมองรายวัน / รายสัปดาห์ (จันทร์–อาทิตย์) */}
            <div className="flex gap-1" role="group" aria-label="มุมมองพยากรณ์">
              {[["day", "รายวัน"], ["week", "รายสัปดาห์"]].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} aria-pressed={view === v}
                        className={`rounded-lg px-2.5 py-1 text-sm ${view === v ? "bg-emerald-700 text-white" : "text-stone-600 ring-1 ring-stone-200"}`}>{label}</button>
              ))}
            </div>
          </div>}>
      {result.error ? <Pending lab="Lab 4.4" error={result.error} /> : (
        <>
          {weekly ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์สัปดาห์หน้า (จ.–อา.)" value={r.week.next == null ? "–" : fmtBaht(r.week.next)} />
              <Stat label={`ย้อนทดสอบ ${r.week.n} สัปดาห์: คลาดเคลื่อนเฉลี่ยต่อสัปดาห์`} value={`${r.week.mapeSeasonal.toFixed(1)}%`}
                    note={`เทียบรายวัน ${r.bt.mapeSeasonal.toFixed(1)}%`} />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง (รายสัปดาห์)" value={`${r.week.mapeFlat.toFixed(1)}%`} note={`เทียบรายวัน ${r.bt.mapeFlat.toFixed(1)}%`} muted />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="คาดการณ์ 7 วันข้างหน้า" value={fmtBaht(r.next7)} />
              <Stat label="ย้อนทดสอบ 28 วัน: คลาดเคลื่อนเฉลี่ยต่อวัน" value={`${r.bt.mapeSeasonal.toFixed(1)}%`} note="วิธีดูวันในสัปดาห์" />
              <Stat label="ถ้าใช้ค่าเฉลี่ย 28 วันเส้นตรง" value={`${r.bt.mapeFlat.toFixed(1)}%`} note="ตัวเปรียบเทียบ" muted />
            </div>
          )}
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weekly ? r.week.chart : r.chart} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eee" />
                <XAxis dataKey="date" tickFormatter={shortDay} minTickGap={36} tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmtShortBaht} width={56} domain={[0, "auto"]} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={weekly ? (d) => `สัปดาห์ ${thaiDay(d)} – ${thaiDay(addDays(d, 6))}` : thaiDay}
                         formatter={(v, n) => [Array.isArray(v) ? `${fmtBaht(v[0])} – ${fmtBaht(v[1])}` : fmtBaht(v), n]} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <ReferenceLine x={weekly ? r.week.lastDate : r.lastDate} stroke={MUTED} strokeDasharray="3 3" label={{ value: "ข้อมูลถึง", position: "insideTopLeft", fontSize: 11, fill: INK }} />
                {/* แถบ 80% คำนวณจากความคลาดเคลื่อนรายวัน จึงแสดงเฉพาะมุมมองรายวัน (รายสัปดาห์ทดสอบได้แค่ไม่กี่สัปดาห์ ประมาณแถบไม่ได้) */}
                {!weekly && <Area name="ช่วงคาดการณ์" dataKey="band" stroke="none" fill={GREEN[1]} isAnimationActive={false} />}
                <Line name="ยอดจริง" dataKey="actual" stroke={INK} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line name="คาดการณ์" dataKey="forecast" stroke={MAIN} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <Insight>
            {weekly
              ? `${branch ?? "ภาพรวม"}: รวมเป็นรายสัปดาห์แล้วคลาดเคลื่อนเฉลี่ย ${r.week.mapeSeasonal.toFixed(1)}% เทียบกับรายวัน ${r.bt.mapeSeasonal.toFixed(1)}% ส่วนหนึ่งเพราะวันที่สูงกว่าคาดกับต่ำกว่าคาดหักล้างกันเมื่อรวมเป็นสัปดาห์ · วัดจากแค่ ${r.week.n} สัปดาห์ ยังน้อยมาก อย่าใช้เป็นข้อสรุปเด็ดขาด`
              : r.bt.mapeFlat > r.bt.mapeSeasonal * 1.5
              ? `${branch ?? "ภาพรวม"}: การดูวันในสัปดาห์ช่วยลดความคลาดเคลื่อนจาก ${r.bt.mapeFlat.toFixed(0)}% เหลือ ${r.bt.mapeSeasonal.toFixed(0)}% เพราะยอดวันธรรมดากับเสาร์-อาทิตย์ต่างกันมาก`
              : `${branch ?? "ภาพรวม"}: สองวิธีแม่นพอ ๆ กัน (${r.bt.mapeSeasonal.toFixed(0)}% กับ ${r.bt.mapeFlat.toFixed(0)}%) ${branch ? "" : "เพราะสาขาออฟฟิศกับห้างขายดีคนละวัน พอรวมกันรูปแบบรายสัปดาห์จึงหักล้างกัน"}`}
            {" "}ใช้วางแผนสต็อกและกะพนักงานรายสัปดาห์ได้ แต่ไม่ควรใช้ตัดสินยอดรายวันของสาขาเดียว
          </Insight>
        </>
      )}
    </Card>
  );
}

function Stat({ label, value, note, muted }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${muted ? "text-stone-500" : ""}`}>{value}</div>
      {note && <div className="text-xs text-stone-400">{note}</div>}
    </div>
  );
}

function AnomalyCard({ daily, holidays }) {
  const [focus, setFocus] = useState(null);
  const result = useMemo(() => tryRun(() => scoreAnomalies(daily, holidays)), [daily, holidays]);
  if (result.error) return <Card title="วันที่ยอดขายผิดปกติ"><Pending lab="Lab 4.5" error={result.error} /></Card>;
  const all = result.value;
  const top = all.filter((a) => !a.holiday).slice(0, 15);
  const holidayHits = all.filter((a) => a.holiday).slice(0, 5);
  return (
    <Card title="วันที่ยอดขายผิดปกติ 15 อันดับ"
          sub="เทียบกับค่ากลางของวันเดียวกันของสัปดาห์ใน 8 สัปดาห์ก่อน · ไม่นับวันหยุดราชการ">
      {/* Lab 4.5B: เมื่อคลิกแถว (focus) ให้แสดงกราฟยอดจริงเทียบค่าปกติ ±4 สัปดาห์รอบวันนั้น */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm tabular-nums">
          <thead className="text-left text-stone-500">
            <tr><th className="py-1 font-medium">#</th><th className="font-medium">วันที่</th><th className="font-medium">สาขา</th>
              <th className="text-right font-medium">ยอดจริง</th><th className="text-right font-medium">ปกติ</th><th className="pl-4 font-medium">ต่างจากปกติ</th></tr>
          </thead>
          <tbody>
            {top.map((a, i) => {
              const sel = focus && focus.date === a.date && focus.branch === a.branch;
              return (
                <tr key={a.date + a.branch} onClick={() => setFocus(sel ? null : a)}
                    className={`cursor-pointer border-t border-stone-100 hover:bg-stone-50 ${sel ? "bg-emerald-50" : ""}`}>
                  <td className="py-1.5 text-stone-400">{i + 1}</td>
                  <td>{thaiDay(a.date)} <span className="text-stone-400">{new Date(a.date + "T00:00:00").toLocaleDateString("th-TH", { weekday: "short" })}</span></td>
                  <td>{a.branch}</td>
                  <td className="text-right">{fmtBaht(a.actual)}</td>
                  <td className="text-right text-stone-500">{fmtBaht(a.expected)}</td>
                  <td className="pl-4">
                    {a.change < 0
                      ? <span className="font-medium text-red-700">▼ ต่ำกว่าปกติ {Math.round(-a.change * 100)}%</span>
                      : <span className="font-medium text-amber-700">▲ สูงกว่าปกติ {Math.round(a.change * 100)}%</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Insight>
        อันดับต้น ๆ คือวันที่ควรโทรถามผู้จัดการสาขาว่าเกิดอะไรขึ้น · ระบบบอกได้ว่า “ผิดปกติ” แต่บอกไม่ได้ว่า “เพราะอะไร”
        {holidayHits.length > 0 && <> · วันหยุดที่ยอดเปลี่ยนมากแต่ไม่นับ เช่น {holidayHits.slice(0, 3).map((h) => `${h.holiday} (${h.branch})`).join(", ")}</>}
      </Insight>
    </Card>
  );
}

export default function ForecastTab({ source }) {
  const state = useAnalytics(source);
  return (
    <AnalyticsShell source={source} state={state} title="พยากรณ์และวันผิดปกติ">
      {(d) => d.daily.error ? <Pending lab="pipeline" error={d.daily.error} /> : (
        <div className="space-y-6">
          {d.meta.alerts?.length > 0 && (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
              🚨 ยอดวันล่าสุดผิดปกติ: {d.meta.alerts.map((a) => `${a.branch} ${fmtBaht(a.actual)} (ปกติ ${fmtBaht(a.expected)})`).join(", ")}
            </p>
          )}
          <ForecastCard daily={d.daily.rows} />
          <AnomalyCard daily={d.daily.rows} holidays={d.meta.holidays ?? {}} />
        </div>
      )}
    </AnalyticsShell>
  );
}
