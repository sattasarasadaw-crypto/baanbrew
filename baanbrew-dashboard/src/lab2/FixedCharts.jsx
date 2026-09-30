// Lab 2.2 · กราฟที่ซ่อมแล้ว (FixedChart1 … FixedChart5) รับ props { rows, products } เหมือน BadChart
// ตัวเลขทุกตัวในข้อความสรุปคำนวณจากข้อมูลจริง ไม่มีตัวเลขพิมพ์ตายตัว
// ฟังก์ชันคำนวณใช้ของคอร์สใน ./lab2Metrics.js และของเราใน ../lib/metrics.js
import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, Cell,
} from "recharts";
import {
  revenueByProduct, branchPerformance, weeklyRevenue, monthlyRevenue, daysInMonth, thaiMonth,
} from "./lab2Metrics.js";
import { formatBaht, formatThaiDate } from "../lib/metrics.js";

const MAIN = "#92400e"; // สีหลักสีเดียว (amber-800 เดียวกับหน้าภาพรวม)
const LIGHT = "#fcd34d"; // สีอ่อน ใช้กับข้อมูลที่ยังไม่ครบ ไม่ต้องการให้เด่น
const GRID = "#e7e5e4";
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const signedPct = (x) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
const shortBaht = (v) => (v >= 1e6 ? `฿${+(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `฿${+(v / 1e3).toFixed(1)}k` : `฿${v}`);
const avgRevenue = (list) => list.reduce((s, d) => s + d.revenue, 0) / list.length;

// โครงร่วมของทุกกราฟ: ข้อความสรุป 1 บรรทัดด้านบน + พื้นที่กราฟเต็มส่วนที่เหลือ
function Frame({ summary, children }) {
  return (
    <div className="flex h-full flex-col">
      <p className="mb-1 text-sm text-stone-700">{summary}</p>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * กราฟ 1: เมนูไหนทำเงินมากที่สุด ควรโปรโมตตัวไหน
 * - แท่งแนวนอนแทน pie: เทียบความยาวแท่งได้แม่นกว่าเทียบมุมวงกลม และมีที่วางชื่อเมนูยาว ๆ
 * - เรียงจากมากไปน้อย แสดงแค่ Top 10: 40 ชิ้นใน pie อ่านไม่ออก
 * - ไม่มีแท่ง "อื่น ๆ" เพราะ 30 เมนูที่เหลือรวมกันใหญ่กว่า Top 10 แท่งเดียวจะบีบเมนูที่สนใจจนเล็ก → บอกเป็นข้อความแทน
 * - สีเดียว: สีรุ้งไม่ได้สื่อความหมายอะไร ชื่อเมนูอยู่ติดแท่งแล้ว
 */
const TOP_N = 10;
export function FixedChart1({ rows, products }) {
  const all = useMemo(() => revenueByProduct(rows, products), [rows, products]);
  const top = all.slice(0, TOP_N);
  const topShare = top.reduce((s, d) => s + d.share, 0);
  const lead = top[0];
  return (
    <Frame summary={<>
      <b>{lead.name}</b> ทำเงินมากที่สุด {formatBaht(lead.revenue)} ({pct(lead.share)}) ·{" "}
      {TOP_N} อันดับแรกรวม {pct(topShare)} ของยอดขาย อีก {all.length - TOP_N} เมนูรวม {pct(1 - topShare)}
    </>}>
      <BarChart data={top} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tickFormatter={shortBaht} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={132} tick={{ fontSize: 11 }} interval={0} />
        <Tooltip formatter={(v, _n, p) => [`${formatBaht(v)} (${pct(p.payload.share)})`, "ยอดขาย"]} cursor={{ fill: "#fef3c7" }} />
        <Bar dataKey="revenue" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="share" position="right" formatter={pct} style={{ fontSize: 11, fill: "#44403c" }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 2: สาขาต่าง ๆ ขายได้ต่างกันมากแค่ไหน
 * - แกน Y เริ่มที่ 0: ถ้าเริ่มที่ 500,000 ความสูงแท่งจะไม่เป็นสัดส่วนกับยอดจริง (ต่าง 2 เท่าดูเหมือนต่างหลายเท่า)
 * - เรียงจากมากไปน้อยแทนเรียงตามตัวอักษร · สีเดียวแทนสีรุ้ง · ใส่ยอดบนหัวแท่ง ไม่ต้องเปิด Tooltip
 * - บอกในข้อความว่าสาขาที่เปิดทีหลังมีวันขายน้อยกว่า (เทียบแบบยุติธรรมอยู่ในกราฟ 5)
 */
export function FixedChart2({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.revenue - a.revenue), [rows]);
  const top = data[0];
  const bottom = data[data.length - 1];
  const maxDays = Math.max(...data.map((d) => d.days));
  return (
    <Frame summary={<>
      <b>{top.branch}</b> ขายได้มากที่สุด {formatBaht(top.revenue)} เป็น <b>{(top.revenue / bottom.revenue).toFixed(2)} เท่า</b> ของ{bottom.branch} (น้อยสุด {formatBaht(bottom.revenue)})
      {bottom.days < maxDays && <> · แต่{bottom.branch}เปิดขายแค่ {bottom.days} วัน จาก {maxDays} วัน</>}
    </>}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="branch" tick={{ fontSize: 12 }} interval={0} />
        <YAxis domain={[0, "auto"]} tickFormatter={shortBaht} width={60} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [formatBaht(v), "ยอดขายรวม"]} cursor={{ fill: "#fef3c7" }} />
        <Bar dataKey="revenue" fill={MAIN} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          <LabelList dataKey="revenue" position="top" formatter={shortBaht} style={{ fontSize: 11, fill: "#44403c" }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 3: ยอดขายโดยรวมโตขึ้นหรือลดลง
 * - รวมเป็นรายสัปดาห์ (weeklyRevenue ตัดสัปดาห์ที่ไม่ครบ 7 วันออกแล้ว) แทน 538 จุดรายวัน → เห็นแนวโน้ม ไม่เห็นความยุ่ง
 * - เส้นบาง ไม่มีจุด · แกน X เป็นวันที่ไทยแบบย่อ เว้นระยะไม่ให้ทับกัน
 * - ข้อความสรุปเทียบ 12 สัปดาห์ล่าสุดกับ 12 สัปดาห์แรก และแยกผลของสาขาที่เปิดใหม่ออก (ไม่งั้นจะดูเหมือนโตเกินจริง)
 */
const WINDOW = 12;
export function FixedChart3({ rows }) {
  const { weeks, growth, newest, growthWithoutNewest } = useMemo(() => {
    const weeks = weeklyRevenue(rows);
    const growth = avgRevenue(weeks.slice(-WINDOW)) / avgRevenue(weeks.slice(0, WINDOW)) - 1;
    const perf = branchPerformance(rows);
    const maxDays = Math.max(...perf.map((b) => b.days));
    const newest = perf.find((b) => b.days < maxDays * 0.9); // สาขาที่เปิดทีหลังชัดเจน
    let growthWithoutNewest = null;
    if (newest) {
      const w = weeklyRevenue(rows.filter((r) => r.branch !== newest.branch));
      growthWithoutNewest = avgRevenue(w.slice(-WINDOW)) / avgRevenue(w.slice(0, WINDOW)) - 1;
    }
    return { weeks, growth, newest, growthWithoutNewest };
  }, [rows]);
  return (
    <Frame summary={<>
      ยอดขายเฉลี่ยต่อสัปดาห์ {WINDOW} สัปดาห์ล่าสุด <b>{signedPct(growth)}</b> เทียบกับ {WINDOW} สัปดาห์แรก
      {newest && <> · ส่วนหนึ่งมาจากสาขา{newest.branch}ที่เปิดใหม่ ถ้าไม่นับ{newest.branch} {signedPct(growthWithoutNewest)}</>}
    </>}>
      <LineChart data={weeks} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="week" tickFormatter={formatThaiDate} minTickGap={48} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, "auto"]} tickFormatter={shortBaht} width={56} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => [formatBaht(v), "ยอดขายทั้งสัปดาห์"]} labelFormatter={(d) => `สัปดาห์เริ่ม ${formatThaiDate(d)}`} />
        <Line dataKey="revenue" stroke={MAIN} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </Frame>
  );
}

/**
 * กราฟ 4: ทำไมเดือนล่าสุดยอดตก ต้องทำโปรฯ ด่วนไหม
 * - ใช้ยอดเฉลี่ยต่อวันแทนยอดรวม: เดือนที่ข้อมูลไม่ครบ (เช่นมีแค่ 20 วัน) ยอดรวมจะต่ำโดยธรรมชาติ ไม่ใช่ยอดตก
 * - เดือนที่ข้อมูลไม่ครบใช้สีอ่อน และบอกจำนวนวันที่มีข้อมูล · แกน Y เริ่มที่ 0
 */
export function FixedChart4({ rows }) {
  const data = useMemo(
    () => monthlyRevenue(rows).map((m) => ({ ...m, full: daysInMonth(m.month), partial: m.days < daysInMonth(m.month) })),
    [rows],
  );
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const change = last.perDay / prev.perDay - 1;
  return (
    <Frame summary={<>
      {thaiMonth(last.month)} {last.partial ? <>มีข้อมูลแค่ <b>{last.days} จาก {last.full} วัน</b> · </> : null}
      ยอดเฉลี่ยต่อวัน {formatBaht(last.perDay)} <b>{signedPct(change)}</b> เทียบกับ{thaiMonth(prev.month)}
      {change >= 0 ? " ยอดขายไม่ได้ตก ยังไม่ต้องทำโปรฯ ด่วน" : " ยอดต่อวันลดลงจริง"}
    </>}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={thaiMonth} tick={{ fontSize: 10 }} interval={1} />
        <YAxis domain={[0, "auto"]} tickFormatter={shortBaht} width={52} tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v, _n, p) => [`${formatBaht(v)} ต่อวัน (ข้อมูล ${p.payload.days}/${p.payload.full} วัน)`, "ยอดเฉลี่ย"]}
          labelFormatter={thaiMonth}
          cursor={{ fill: "#fef3c7" }}
        />
        <Bar dataKey="perDay" radius={[3, 3, 0, 0]} isAnimationActive={false}>
          {data.map((d) => <Cell key={d.month} fill={d.partial ? LIGHT : MAIN} />)}
          <LabelList
            dataKey="days"
            content={({ x, y, width, index }) => data[index].partial ? (
              <text x={x + width / 2} y={y - 5} textAnchor="middle" fill="#78716c" fontSize={10}>{data[index].days} วัน</text>
            ) : null}
          />
        </Bar>
      </BarChart>
    </Frame>
  );
}

/**
 * กราฟ 5: ผู้จัดการสาขาไหนควรได้รับการพัฒนาเร่งด่วน
 * - ใช้ยอดเฉลี่ยต่อวันที่เปิดขายแทนยอดรวม: อารีย์เปิดทีหลัง ยอดรวมจึงต่ำโดยธรรมชาติ ไม่ยุติธรรมกับผู้จัดการ
 * - เรียงจากมากไปน้อย สีเดียว ไม่ใส่ป้าย "แย่ที่สุด" สีแดง (ตัวเลขอย่างเดียวยังสรุปเรื่องคนไม่ได้)
 * - ข้อความเตือนว่ามีปัจจัยอื่นที่ต้องดูก่อน เช่น ประเภทสาขา (ห้าง/ออฟฟิศ/ชุมชน/สถานศึกษา)
 */
export function FixedChart5({ rows }) {
  const data = useMemo(() => branchPerformance(rows).sort((a, b) => b.perDay - a.perDay), [rows]);
  const lowest = data[data.length - 1];
  const byTotal = [...data].sort((a, b) => a.revenue - b.revenue)[0];
  return (
    <Frame summary={<>
      เทียบต่อวันที่เปิดขาย <b>{lowest.branch}</b> ต่ำสุด {formatBaht(lowest.perDay)}/วัน
      {byTotal.branch !== lowest.branch && <> · {byTotal.branch}ที่ยอดรวมต่ำสุดได้ {formatBaht(byTotal.perDay)}/วัน (เปิด {byTotal.days} วัน)</>}
      {" "}· ต้องดูประเภทสาขาและช่วงปิดเทอม/วันหยุดก่อนสรุปเรื่องผู้จัดการ
    </>}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 72, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, "auto"]} tickFormatter={shortBaht} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="branch" width={90} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(v, _n, p) => [`${formatBaht(v)} ต่อวัน · เปิดขาย ${p.payload.days} วัน · ยอดรวม ${formatBaht(p.payload.revenue)}`, "ยอดเฉลี่ย"]}
          cursor={{ fill: "#fef3c7" }}
        />
        <Bar dataKey="perDay" fill={MAIN} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="perDay" position="right" formatter={(v) => `${formatBaht(v)}/วัน`} style={{ fontSize: 11, fill: "#44403c" }} />
        </Bar>
      </BarChart>
    </Frame>
  );
}
