# ===== ขั้นที่ 4 · ทำความสะอาด (ทำบน clean = df.copy() ไม่แก้ df) =====
# df อ่านมาเป็น str ทุกคอลัมน์ ค่าว่างเป็น ""
import re
from datetime import datetime

import pandas as pd

STD = ["สยาม", "สีลม", "อารีย์", "บางนา", "มหาวิทยาลัย"]
COLS = list(df.columns)  # ลำดับคอลัมน์เดิม ต้องคงไว้ตอนจบ

clean = df.copy()
log = []  # (ขั้นตอน, จำนวนแถวที่กระทบ, การตัดสินใจ)
rows_before = len(clean)


def add_log(step, n, decision):
    log.append({"ขั้นตอน": step, "จำนวนแถวที่กระทบ": int(n), "การตัดสินใจ": decision})


# ---------------------------------------------------------------
# 1) แถวซ้ำทุกคอลัมน์ — ลบแถวส่วนเกิน เก็บแถวแรกไว้
#    ห้ามใช้ order_id อย่างเดียว เพราะ 1 บิลมีหลายแถว (จะลบรายการดีทิ้ง)
# ---------------------------------------------------------------
dup = clean.duplicated(keep="first")
clean = clean[~dup]
add_log("1) ลบแถวซ้ำทุกคอลัมน์", dup.sum(), "ลบ: POS ส่งข้อมูลซ้ำ ถ้าเก็บไว้ยอดขายจะนับเกิน")

# ---------------------------------------------------------------
# 2) datetime → YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ.
#    ไม่ใช้ pd.to_datetime() เพราะอาจสลับวัน/เดือน (01/04 → 4 ม.ค.) และแปลงเป็น UTC
#    แยกข้อความด้วย regex ทีละรูปแบบ:
#      ก. ISO  YYYY-MM-DDTHH:MM:SS+07:00  (ปี ค.ศ. หรือ พ.ศ.)
#      ข. DD/MM/YYYY H:MM หรือ HH:MM      (ปี ค.ศ. หรือ พ.ศ., ไม่มีวินาที → ใส่ 00, ถือเป็นเวลาไทย +07:00)
#    ปี > 2400 ถือว่าเป็น พ.ศ. → ลบ 543
# ---------------------------------------------------------------
ISO = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+07:00$")
DMY = re.compile(r"^(\d{1,2})/(\d{1,2})/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$")


def to_iso(s):
    """คืน (ข้อความ ISO ปี ค.ศ., ชนิดที่เจอ) หรือ (None, 'แปลงไม่ได้')"""
    s = s.strip()
    m = ISO.match(s)
    if m:
        y, mo, d, h, mi, se = map(int, m.groups())
        fmt = "ISO"
    else:
        m = DMY.match(s)
        if not m:
            return None, "แปลงไม่ได้"
        d, mo, y, h, mi = map(int, m.groups()[:5])
        se = int(m.group(6) or 0)
        fmt = "DD/MM/YYYY"
    buddhist = y > 2400  # ปี พ.ศ.
    if buddhist:
        y -= 543
    kind = f"{fmt} ปี {'พ.ศ.' if buddhist else 'ค.ศ.'}"
    try:
        datetime(y, mo, d, h, mi, se)  # ตรวจว่าเป็นวันเวลาที่มีจริง
    except ValueError:
        return None, "แปลงไม่ได้"
    return f"{y:04d}-{mo:02d}-{d:02d}T{h:02d}:{mi:02d}:{se:02d}+07:00", kind


converted = clean["datetime"].map(to_iso)
new_dt = converted.str[0]
kind = converted.str[1]
for k in ["ISO ปี พ.ศ.", "DD/MM/YYYY ปี ค.ศ.", "DD/MM/YYYY ปี พ.ศ."]:
    add_log(f"2) แปลง datetime: {k}", (kind == k).sum(), "แปลงเป็น YYYY-MM-DDTHH:MM:SS+07:00 ปี ค.ศ. (ไม่มีวินาทีใส่ 00)")
bad_dt = new_dt.isna()
if bad_dt.any():
    print("⚠️ datetime ที่แปลงไม่ได้ (ต้องตัดสินใจเอง):", clean.loc[bad_dt, "datetime"].unique()[:10])
clean["datetime"] = new_dt.where(~bad_dt, clean["datetime"])
add_log("2) datetime ที่แปลงไม่ได้", bad_dt.sum(), "ไม่แก้ รายงานไว้ให้ตัดสินใจ (ควรเป็น 0)")

# ---------------------------------------------------------------
# 3) ชื่อสาขา — ตัดช่องว่างหัว/ท้ายก่อน (ไม่งั้น "สยาม␣" จะไม่ถูก map) แล้ว map เป็น 5 ชื่อมาตรฐาน
#    "ม." = มหาวิทยาลัย (ทีม POS ยืนยัน)
# ---------------------------------------------------------------
BRANCH_MAP = {
    "Siam": "สยาม", "สาขาสยาม": "สยาม",
    "Silom": "สีลม",
    "Bangna": "บางนา",
    "มหาลัย": "มหาวิทยาลัย", "ม.": "มหาวิทยาลัย",
    "อารีย": "อารีย์", "Ari": "อารีย์",
}
stripped = clean["branch"].str.strip()
n_strip = stripped.ne(clean["branch"]).sum()
mapped = stripped.replace(BRANCH_MAP)
n_map = mapped.ne(stripped).sum()
clean["branch"] = mapped
add_log("3) ตัดช่องว่างหัว/ท้ายชื่อสาขา", n_strip, "strip ก่อน map")
add_log("3) map ชื่อสาขาเป็นชื่อมาตรฐาน", n_map, "map ตามตาราง BRANCH_MAP (ม. = มหาวิทยาลัย ตามทีม POS)")
left_branch = ~clean["branch"].isin(STD)
if left_branch.any():
    print("⚠️ ชื่อสาขาที่ยังไม่อยู่ใน 5 ชื่อ (ต้องเพิ่มใน BRANCH_MAP):", clean.loc[left_branch, "branch"].unique())

# ---------------------------------------------------------------
# 4) unit_price — ตัดคำว่า "บาท" แล้วแปลงเป็นตัวเลข · ราคาติดลบแปลงเป็นบวก · เก็บเป็นจำนวนเต็ม
#    ราคาติดลบ: ฝ่ายบัญชียืนยันว่าไม่มีการคืนเงินในระบบ POS นี้ → เป็นการพิมพ์ผิด ไม่ใช่การคืนเงิน
# ---------------------------------------------------------------
price_str = clean["unit_price"].str.strip()
has_baht = price_str.str.contains("บาท")
price = pd.to_numeric(price_str.str.replace("บาท", "", regex=False).str.strip(), errors="coerce")
add_log("4) unit_price: ตัดคำว่า 'บาท'", has_baht.sum(), "ตัดคำแล้วแปลงเป็นตัวเลข")
neg = price < 0
price = price.abs()
add_log("4) unit_price: ราคาติดลบ", neg.sum(), "แปลงเป็นบวก: ไม่มีการคืนเงินในระบบนี้ ค่าติดลบคือพิมพ์ผิด")
bad_price = price.isna() | (price % 1 != 0)
if bad_price.any():
    print("⚠️ unit_price ที่แปลงเป็นจำนวนเต็มไม่ได้:", clean.loc[bad_price, "unit_price"].unique()[:10])
add_log("4) unit_price ที่แปลงเป็นจำนวนเต็มไม่ได้", bad_price.sum(), "ไม่แก้ รายงานไว้ให้ตัดสินใจ (ควรเป็น 0)")

# ---------------------------------------------------------------
# 5) ลบแถว qty = 0 (บิลที่ยกเลิก) และแถว product_id ว่าง
# ---------------------------------------------------------------
qty = pd.to_numeric(clean["qty"].str.strip(), errors="coerce")
qty_zero = qty == 0
add_log("5) ลบแถว qty = 0", qty_zero.sum(), "ลบ: เป็นบิลที่ยกเลิก")
no_product = clean["product_id"].str.strip().eq("")
add_log("5) ลบแถว product_id ว่าง", (no_product & ~qty_zero).sum(),
        "ลบ: ไม่รู้ว่าขายสินค้าอะไร เดาจากราคาไม่ได้แน่นอน")
keep = ~qty_zero & ~no_product
clean = clean[keep].copy()
price = price[keep]

# ---------------------------------------------------------------
# 6) จัดรูปแบบผลลัพธ์ — คอลัมน์และลำดับเหมือนเดิม unit_price เป็นจำนวนเต็ม
# ---------------------------------------------------------------
clean["unit_price"] = price.astype(int)
clean["qty"] = pd.to_numeric(clean["qty"].str.strip()).astype(int).astype(str)
clean["product_id"] = clean["product_id"].str.strip()
clean = clean[COLS].reset_index(drop=True)

# ตรวจแถวซ้ำอีกรอบหลังแปลง (แถวที่ต่างกันแค่รูปแบบวันที่/ชื่อสาขาอาจกลายเป็นแถวเดียวกัน)
dup_after = clean.duplicated(keep="first")
add_log("6) แถวซ้ำที่เกิดใหม่หลังแปลงรูปแบบ", dup_after.sum(), "รายงานไว้ ไม่ลบอัตโนมัติ (ควรเป็น 0)")

cleaning_log = pd.DataFrame(log)
print(cleaning_log.to_string(index=False))
print(f"\nจำนวนแถว: ก่อน {rows_before:,} → หลัง {len(clean):,} (ตัดทิ้ง {rows_before - len(clean):,} แถว)")
