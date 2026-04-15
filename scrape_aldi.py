#!/usr/bin/env python3
"""
ALDI SÜD Offer Scraper v3 — Basierend auf echtem HTML-Layout.
Pattern: Brand → Produktname → Gewicht → (Preis/kg) → Endpreis → ² → Alter Preis
"""
import requests, re, json, sys
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OUTPUT = BASE / "offers" / "aldi.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
}

FOOD_KW = [
    "hähnchen", "huhn", "schwein", "rind", "pute", "hack", "wurst", "bratwurst",
    "schnitzel", "nuggets", "cordon", "steak", "filet", "braten", "gulasch",
    "schinken", "speck", "salami", "metzgerei", "wiener",
    "lachs", "forelle", "dorade", "thunfisch", "garnelen", "fisch", "backfisch",
    "joghurt", "butter", "milch", "käse", "sahne", "quark", "eier", "feta",
    "mozzarella", "parmesan", "buttermilch", "schmand", "grana padano",
    "apfel", "orange", "banane", "erdbeer", "mango", "mandarin", "birne",
    "kiwi", "zitrone", "heidelbeer", "avocado",
    "paprika", "kartoffel", "zwiebel", "karotte", "möhre", "gurke",
    "chicoree", "kohlrabi", "spargel", "tomate", "zucchini", "salat",
    "spinat", "brokkoli", "blumenkohl", "lauch", "champignon", "pilz", "mais",
    "reis", "nudeln", "mehl", "brot", "toast", "müsli", "spaghetti",
    "couscous", "gnocchi", "tortellini",
    "öl", "essig", "soße", "ketchup", "senf", "mayo", "pesto",
    "kokosmilch", "brühe", "honig", "kaffee", "tee",
    "schokolade", "keks", "chips", "nuss", "mandel",
]

EXCLUDE_KW = [
    "bettwäsche", "handtuch", "socken", "jacke", "hose", "werkzeug",
    "blume", "pflanze", "dünger", "erde", "kissen", "decke", "lampe",
    "spielzeug", "shampoo", "duschgel", "seife", "waschmittel", "reiniger",
    "katzenstreu", "hundebett", "wein", "bier", "sekt",
    "obstbäume", "obstbaum", "rhododendron", "geranie",
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
    if any(k in n for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","bratwurst","schnitzel","nuggets","cordon","steak","braten","gulasch","schinken","speck","salami","metzgerei","wiener"]): return "fleisch"
    if any(k in n for k in ["lachs","fisch","garnelen","thunfisch","dorade","backfisch"]): return "fisch"
    if any(k in n for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan","buttermilch","grana"]): return "milchprodukte"
    if any(k in n for k in ["reis","nudeln","mehl","brot","toast","müsli","spaghetti","gnocchi","couscous","tortellini"]): return "trockenwaren"
    if any(k in n for k in ["apfel","orange","banane","erdbeer","mango","mandarin","birne","kiwi","heidelbeer","avocado","zitrone"]): return "obst"
    if any(k in n for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","zucchini","spinat","brokkoli","tomate","blumenkohl","champignon","pilz","salat","spargel","lauch","kohlrabi","chicoree","mais"]): return "gemuese"
    return "sonstiges"

def scrape():
    print(f"🔍 ALDI SÜD — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    url = "https://www.aldi-sued.de/de/angebote.html"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
    except Exception as e:
        print(f"❌ {e}"); return False
    if r.status_code != 200:
        print(f"❌ HTTP {r.status_code}"); return False

    html = r.text
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '\n', text)
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    brands = {'NATUR LIEBLING','NATUR LIEBLINGE','BIO NATURLAND','MEINE METZGEREI',
              'BESTES AUS DER REGION','GOLDEN SEAFOOD','BIO','KLEINE SCHÄTZE'}

    products = []
    for i, line in enumerate(lines):
        if re.search(r'\(.*€.*\)', line): continue
        if line.strip() == '²': continue
        if re.match(r'Verfügbar', line): continue
        pm = re.fullmatch(r'(\d+[,.]\d{2})\s*€(?:\s*²\s*(\d+[,.]\d{2})\s*€)?', line)
        if not pm: continue
        price = float(pm.group(1).replace(",", "."))
        old = float(pm.group(2).replace(",", ".")) if pm.group(2) else None
        if price < 0.10 or price > 50: continue

        name = ""
        for j in range(i-1, max(i-5, 0), -1):
            c = lines[j].strip()
            if c in brands: continue
            if re.match(r'^\d+[,.]?\d*\s*(kg|g|ml|l)$', c, re.I): continue
            if re.match(r'^\(.*€.*\)$', c): continue
            if c == '²': continue
            if re.match(r'^\d+[,.]\d{2}\s*€', c): continue
            if re.match(r'Verfügbar', c): continue
            if c in ['Tiefkühlung','Kühlung','Aktion','Vegan']: continue
            if len(c) < 3 or re.match(r'^[\d,.\s²€/]+$', c): continue
            name = c
            if j > 0 and lines[j-1].strip() in brands:
                name = lines[j-1].strip() + " " + name
            break
        if not name or not is_food(name): continue

        unit_m = re.search(r'(\d+(?:,\d+)?\s*(?:kg|g|ml|l|Stück))', name, re.I)
        products.append({"name": name, "price": price, "old_price": old,
                        "unit": unit_m.group(1) if unit_m else "", "category": categorize(name)})

    seen = set(); unique = []
    for p in products:
        k = p["name"].lower()
        if k not in seen: seen.add(k); unique.append(p)

    OUTPUT.parent.mkdir(exist_ok=True)
    today = datetime.now(); mon = today - timedelta(days=today.weekday())
    result = {"store": "ALDI SÜD", "date": today.strftime("%Y-%m-%d"),
              "valid_from": mon.strftime("%Y-%m-%d"),
              "valid_until": (mon+timedelta(days=5)).strftime("%Y-%m-%d"),
              "offers": unique}
    with open(OUTPUT, "w") as f: json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(unique)} → {OUTPUT}")
    return True

if __name__ == "__main__": sys.exit(0 if scrape() else 1)
