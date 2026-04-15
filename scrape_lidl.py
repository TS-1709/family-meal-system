#!/usr/bin/env python3
"""
LIDL Offer Scraper — Extrahiert Wochenangebote von lidl.de
"""
import requests, re, json, sys
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OUTPUT = BASE / "offers" / "lidl.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
}

FOOD_KW = [
    "hähnchen", "huhn", "schwein", "rind", "pute", "hack", "wurst", "bratwurst",
    "schnitzel", "nuggets", "steak", "filet", "braten", "gulasch", "schinken", "speck",
    "lachs", "fisch", "garnelen", "thunfisch", "dorade",
    "joghurt", "butter", "milch", "käse", "sahne", "quark", "eier", "feta", "mozzarella",
    "apfel", "orange", "banane", "erdbeer", "mango", "birne", "kiwi", "zitrone", "avocado",
    "paprika", "kartoffel", "zwiebel", "karotte", "möhre", "gurke", "tomate", "zucchini",
    "spinat", "brokkoli", "blumenkohl", "spargel", "salat", "champignon",
    "reis", "nudeln", "pasta", "mehl", "brot", "toast", "müsli", "couscous", "gnocchi",
    "öl", "essig", "soße", "ketchup", "senf", "mayo", "kokosmilch", "brühe", "honig",
    "kaffee", "tee", "schokolade", "nuss", "chips", "keks",
    "salat-mix", "datteln",
]

EXCLUDE_KW = [
    "sekt", "wein", "bier", "vodka", "gin",
    "waschmittel", "spülmittel", "reiniger", "shampoo", "duschgel",
    "spielzeug", "blume", "pflanze", "dünger", "erde",
    "werkzeug", "parkside", "silvercrest", "livarno", "crivit", "esmara",
    "socken", "jacke", "hose", "schuh", "kleid",
    "kissen", "decke", "bett", "lampe", "möbel",
]

def is_food(name):
    n = name.lower()
    for ex in EXCLUDE_KW:
        if ex in n: return False
    for fo in FOOD_KW:
        if fo in n: return True
    return False

def categorize(name):
    n = name.lower()
    if any(k in n for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","schnitzel","nuggets","steak","braten","gulasch","schinken","speck"]): return "fleisch"
    if any(k in n for k in ["lachs","fisch","garnelen","thunfisch","dorade"]): return "fisch"
    if any(k in n for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella"]): return "milchprodukte"
    if any(k in n for k in ["reis","nudeln","pasta","mehl","brot","toast","müsli","couscous","gnocchi"]): return "trockenwaren"
    if any(k in n for k in ["apfel","orange","banane","erdbeer","mango","birne","kiwi","zitrone","avocado","dattel"]): return "obst"
    if any(k in n for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","tomate","zucchini","spinat","brokkoli","blumenkohl","spargel","salat","champignon"]): return "gemuese"
    return "sonstiges"

def scrape():
    print(f"🔍 LIDL — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    # Try multiple LIDL offer URLs
    urls = [
        "https://www.lidl.de/",
        "https://www.lidl.de/c/unsere-wochenangebote/s10005611",
    ]
    all_lines = []
    for url in urls:
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200 and len(r.text) > 5000:
                text = re.sub(r'<script[^>]*>.*?</script>', '', r.text, flags=re.DOTALL)
                text = re.sub(r'<style[^>]*>.*?</style>', '', r.text, flags=re.DOTALL)
                text = re.sub(r'<[^>]+>', '\n', text)
                all_lines.extend([l.strip() for l in text.split('\n') if l.strip()])
                print(f"  ✓ {url} ({len(r.text):,} bytes)")
        except: continue

    if not all_lines:
        print("❌ Keine Daten"); return False

    products = []
    for i, line in enumerate(all_lines):
        # LIDL pattern: "Produkt, je XXX g, X,XX €*"
        m = re.match(r'^(.+?),?\s*(?:je\s+)?(\d+(?:,\d+)?\s*(?:g|kg|ml|l|Stück))?\s*,?\s*(\d+[,.]\d{2})\s*€', line)
        if m:
            name = m.group(1).strip()
            unit = m.group(2) or ""
            price = float(m.group(3).replace(",", "."))
            if price < 0.10 or price > 50: continue
            name = re.sub(r'^(ALDI|Lidl|Pikolo|Vemondo|Milbona|Sondey|Alesto|Combino|Mama Nucci|Dulano|Cien|Formil|W5)\s*', '', name, flags=re.I).strip()
            if is_food(name):
                products.append({"name": name, "price": price, "old_price": None,
                               "unit": unit, "category": categorize(name)})

    seen = set(); unique = []
    for p in products:
        k = p["name"].lower()
        if k not in seen: seen.add(k); unique.append(p)

    OUTPUT.parent.mkdir(exist_ok=True)
    today = datetime.now(); mon = today - timedelta(days=today.weekday())
    result = {"store": "LIDL", "date": today.strftime("%Y-%m-%d"),
              "valid_from": mon.strftime("%Y-%m-%d"),
              "valid_until": (mon+timedelta(days=5)).strftime("%Y-%m-%d"),
              "offers": unique}
    with open(OUTPUT, "w") as f: json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(unique)} → {OUTPUT}")
    for p in unique[:10]: print(f"   {p['name']}: {p['price']:.2f}€")
    return True

if __name__ == "__main__": sys.exit(0 if scrape() else 1)
