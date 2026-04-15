#!/usr/bin/env python3
"""
REWE Offer Scraper — Extrahiert Wochenangebote von rewe.de/angebote/
"""
import requests, re, json, sys
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OUTPUT = BASE / "offers" / "rewe.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
}

FOOD_KW = [
    "hähnchen", "huhn", "schwein", "rind", "pute", "hack", "wurst", "bratwurst",
    "schnitzel", "nuggets", "steak", "filet", "braten", "gulasch", "schinken", "speck", "salami",
    "lachs", "fisch", "garnelen", "thunfisch", "dorade",
    "joghurt", "butter", "milch", "käse", "sahne", "quark", "eier", "feta", "mozzarella", "parmesan",
    "apfel", "äpfel", "orange", "banane", "erdbeer", "mango", "birne", "kiwi", "zitrone", "avocado",
    "paprika", "kartoffel", "zwiebel", "karotte", "möhre", "gurke", "tomate", "zucchini",
    "spinat", "brokkoli", "blumenkohl", "spargel", "salat", "champignon", "lauch",
    "reis", "nudeln", "pasta", "mehl", "brot", "toast", "müsli", "tortellini", "gnocchi", "couscous",
    "öl", "essig", "soße", "ketchup", "senf", "mayo", "pesto", "kokosmilch", "brühe", "honig",
    "kaffee", "tee", "schokolade", "nuss",
    "weichkäse", "scheiben", "schnittkäse", "frischkäse",
]

EXCLUDE_KW = [
    "sekt", "wein", "bier", "prosecco", "vodka", "gin", "whisky", "spirituosen",
    "waschmittel", "spülmittel", "reiniger", "shampoo", "duschgel", "seife",
    "spielzeug", "blume", "pflanze",
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
    if any(k in n for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","schnitzel","nuggets","steak","braten","gulasch","schinken","speck","salami"]): return "fleisch"
    if any(k in n for k in ["lachs","fisch","garnelen","thunfisch","dorade"]): return "fisch"
    if any(k in n for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan","weichkäse","schnittkäse","frischkäse","scheiben"]): return "milchprodukte"
    if any(k in n for k in ["reis","nudeln","pasta","mehl","brot","toast","müsli","tortellini","gnocchi","couscous"]): return "trockenwaren"
    if any(k in n for k in ["apfel","äpfel","orange","banane","erdbeer","mango","birne","kiwi","zitrone","avocado"]): return "obst"
    if any(k in n for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","tomate","zucchini","spinat","brokkoli","blumenkohl","spargel","salat","champignon","lauch"]): return "gemuese"
    return "sonstiges"

def scrape():
    print(f"🔍 REWE — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    url = "https://www.rewe.de/angebote/"
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

    products = []
    for i, line in enumerate(lines):
        # REWE pattern: "Produktname, Aktionspreis X,XX €"
        m = re.match(r'^(.+?),\s*Aktionspreis\s*(\d+[,.]\d{2})\s*€', line)
        if m:
            name = m.group(1).strip()
            price = float(m.group(2).replace(",", "."))
            # Clean brand prefix
            name = re.sub(r'^(REWE Beste Wahl|REWE Bio|ja!|BIO|BIOS)\s*', '', name).strip()
            if is_food(name):
                products.append({"name": name, "price": price, "old_price": None,
                               "unit": "", "category": categorize(name)})
            continue

        # Pattern: "Produkt Details Aktion X,XX €"
        m2 = re.match(r'^(.+?)\s+Aktion\s+(\d+[,.]\d{2})\s*€', line)
        if m2:
            name = m2.group(1).strip()
            price = float(m2.group(2).replace(",", "."))
            # Look at previous lines for product name
            if len(name) < 5:
                for j in range(i-1, max(i-3, 0), -1):
                    prev = lines[j].strip()
                    if len(prev) > 3 and not re.search(r'€', prev):
                        name = prev; break
            name = re.sub(r'^(REWE Beste Wahl|REWE Bio|ja!|BIO)\s*', '', name).strip()
            if is_food(name):
                products.append({"name": name, "price": price, "old_price": None,
                               "unit": "", "category": categorize(name)})

    seen = set(); unique = []
    for p in products:
        k = p["name"].lower()
        if k not in seen: seen.add(k); unique.append(p)

    OUTPUT.parent.mkdir(exist_ok=True)
    today = datetime.now(); mon = today - timedelta(days=today.weekday())
    result = {"store": "REWE", "date": today.strftime("%Y-%m-%d"),
              "valid_from": mon.strftime("%Y-%m-%d"),
              "valid_until": (mon+timedelta(days=5)).strftime("%Y-%m-%d"),
              "offers": unique}
    with open(OUTPUT, "w") as f: json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(unique)} → {OUTPUT}")
    for p in unique[:10]: print(f"   {p['name']}: {p['price']:.2f}€")
    return True

if __name__ == "__main__": sys.exit(0 if scrape() else 1)
