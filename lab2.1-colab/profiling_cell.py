# ===== ขั้นที่ 2 · Data profiling (รายงานอย่างเดียว ไม่แก้ df) =====
# df อ่านมาเป็น str ทุกคอลัมน์ ค่าว่างเป็น "" (load_csv ใช้ dtype=str, keep_default_na=False)
import pandas as pd

STD = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"]  # ชื่อมาตรฐานเดียวกับ STD_BRANCHES ของ check()


def is_blank(s):
    """ว่าง = "" หรือมีแต่ช่องว่าง"""
    return s.str.strip().eq("")


def samples(s, n=5):
    """ตัวอย่างค่าไม่ซ้ำ n ค่าแรก ใส่เครื่องหมายคำพูดให้เห็นช่องว่าง"""
    return ", ".join(repr(v) for v in s.unique()[:n])


def header(title):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")


# 1) ค่าว่างและค่าไม่ซ้ำของแต่ละคอลัมน์
header("1) ค่าว่างและค่าไม่ซ้ำ รายคอลัมน์")
empty = df.eq("").sum()
profile = pd.DataFrame({
    "empty": empty,                                   # "" จริง ๆ
    "blank_space_only": df.apply(is_blank).sum() - empty,  # มีแต่ช่องว่าง เช่น " "
    "unique": df.nunique(),
})
print(f"จำนวนแถวทั้งหมด: {len(df):,}")
print(profile.to_string())

# 2) แถวที่ซ้ำกันทุกคอลัมน์ — นับเฉพาะแถวส่วนเกิน (3 แถวเหมือนกัน = 2) ห้ามใช้ order_id เพราะ 1 บิลมีหลายแถว
header("2) แถวที่ซ้ำกันทุกคอลัมน์")
n_dup = int(df.duplicated(keep="first").sum())
print(f"n_dup = {n_dup:,}")

# 3) datetime ต้องผ่าน 3 ขั้น: รูปแบบ YYYY-MM-DDThh:mm → ปี ค.ศ. 1900–2100 → เป็นวันที่มีจริง
header("3) datetime ที่ไม่ใช่ YYYY-MM-DDT... ปี ค.ศ.")
dt = df["datetime"].str.strip()
parts = dt.str.extract(r"^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}")
fmt_ok = parts[0].notna()
year_ok = pd.to_numeric(parts[0], errors="coerce").between(1900, 2100)
real_date = pd.to_datetime(parts[0] + "-" + parts[1] + "-" + parts[2], format="%Y-%m-%d", errors="coerce").notna()
reason = pd.Series("", index=df.index)
reason[dt.eq("")] = "ว่าง"
reason[reason.eq("") & ~fmt_ok] = "รูปแบบไม่ใช่ YYYY-MM-DDThh:mm (เช่น DD/MM/YYYY)"
reason[reason.eq("") & ~year_ok] = "ปีไม่อยู่ในช่วง ค.ศ. 1900–2100 (เช่น ปี พ.ศ.)"
reason[reason.eq("") & ~real_date] = "ไม่ใช่วันที่ที่มีจริง (เช่น 2025-02-30)"
bad_dt = reason.ne("")
n_bad_dt = int(bad_dt.sum())
print(f"n_bad_dt = {n_bad_dt:,}")
for r, cnt in reason[bad_dt].value_counts().items():
    print(f"  {cnt:>6,}  {r}  ตัวอย่าง: {samples(df.loc[reason.eq(r), 'datetime'], 3)}")

# 4) ชื่อสาขาทั้งหมด — ผิด = ไม่ตรงกับ 5 ชื่อมาตรฐานแบบตัวต่อตัว (ช่องว่างท้ายชื่อก็นับว่าผิด)
header("4) ชื่อสาขาทั้งหมดพร้อมจำนวนแถว (✓ = ชื่อมาตรฐาน)")
for name, cnt in df["branch"].value_counts().items():
    note = "" if name in STD else ("  ← ต่างแค่ช่องว่าง" if name.strip() in STD else "")
    print(f"  {'✓' if name in STD else '✗'} {name!r:18} {cnt:>7,}{note}")
n_bad_branch = int((~df["branch"].isin(STD)).sum())
print(f"n_bad_branch = {n_bad_branch:,}")

# 5) unit_price: ตัดช่องว่างหัวท้ายก่อนแปลง · ค่าว่างไม่นับในข้อนี้ (ดูข้อ 1) · "1,200" นับว่าแปลงไม่ได้
header("5) unit_price ที่แปลงเป็นตัวเลขไม่ได้ และที่ติดลบ")
price_str = df["unit_price"].str.strip()
price = pd.to_numeric(price_str, errors="coerce")
price_text = price_str.ne("") & price.isna()
n_price_text = int(price_text.sum())
n_price_neg = int((price < 0).sum())
print(f"n_price_text = {n_price_text:,}  ตัวอย่าง: {samples(df.loc[price_text, 'unit_price'])}")
print(f"n_price_neg  = {n_price_neg:,}  ตัวอย่าง: {samples(df.loc[price < 0, 'unit_price'])}")

# 6) qty = 0 (แปลงเป็นตัวเลขก่อน จึงนับ "0", "0.0", " 0 " ครบ) และ product_id ว่าง ("" หรือมีแต่ช่องว่าง)
header("6) qty = 0 และ product_id ว่าง")
qty = pd.to_numeric(df["qty"].str.strip(), errors="coerce")
n_qty_zero = int((qty == 0).sum())
n_missing_product = int(is_blank(df["product_id"]).sum())
print(f"n_qty_zero        = {n_qty_zero:,}")
print(f"n_missing_product = {n_missing_product:,}")

header("สรุป")
for k in ["n_dup", "n_bad_dt", "n_bad_branch", "n_price_text", "n_price_neg", "n_qty_zero", "n_missing_product"]:
    print(f"  {k:<18} {globals()[k]:>6,}")
