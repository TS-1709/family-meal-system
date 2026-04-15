#!/usr/bin/env python3
"""
ALDI SÜD Offer Scraper v3 — Basierend auf echtem HTML-Layout.
Pattern: Brand → Produktname → Gewicht → (Preis/kg) → Endpreis → ² → Alter Preis
"""

import requests, re, json, sys
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OUTPUT = BASE / "current_offers.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
}

BRANDS = {
    'NATUR LIEBLING', 'NATUR LIEBLINGE', 'BIO NATURLAND', 'MEINE METZGEREI',
    'BESTES AUS DER REGION', 'GOLDEN SEAFOOD', '· FAIR&GUT ·', 'FAIR&GUT',
    'NUR NUR NATUR', 'KLEINE SCHÄTZE', 'MEINE BACKWELT', 'BIO',
    'CHOCEUR', 'BISCOTTO', 'BISCOTTOS', 'GOURMET FINEST CUISINE',
}

FOOD_KW = [
    "hähnchen", "huhn", "schwein", "rind", "pute", "hack", "wurst", "bratwurst",
    "schnitzel", "nuggets", "cordon", "steak", "filet", "braten", "gulasch",
    "schinken", "speck", "salami", "metzgerei", "cevapcici", "wiener",
    "lachs", "forelle", "dorade", "thunfisch", "garnelen", "fisch", "backfisch",
    "shrimps", "hering", "makrele",
    "joghurt", "butter", "milch", "käse", "sahne", "quark", "eier", "feta",
    "mozzarella", "parmesan", "ricotta", "halloumi", "buttermilch", "schmand",
    "apfel", "äpfel", "orange", "banane", "erdbeer", "mango", "mandarin",
    "birne", "kiwi", "zitrone", "trauben", "himbeer", "heidelbeer",
    "kirsche", "pfirsich", "pflaume", "melone", "ananas", "avocado",
    "granatapfel", "dattel",
    "paprika", "kartoffel", "zwiebel", "karotte", "möhre", "gurke",
    "chicoree", "kohlrabi", "spargel", "tomate", "zucchini", "salat",
    "spinat", "brokkoli", "blumenkohl", "lauch", "sellerie", "rucola",
    "champignon", "pilz", "fenchel", "aubergine", "mais", "kohl",
    "reis", "nudeln", "pasta", "mehl", "brot", "toast", "müsli",
    "haferflocken", "couscous", "linsen", "bohnen", "kichererbsen",
    "gnocchi", "tortellini", "maultaschen", "lasagne",
    "öl", "essig", "soße", "ketchup", "senf", "mayo", "pesto",
    "tomatensoße", "kokosmilch", "brühe", "honig", "marmelade",
    "kaffee", "tee", "saft", "apfelmus",
    "schokolade", "keks", "chips", "nuss", "mandel", "haselnuss",
    "cornichons", "oliven", "dose",
]

EXCLUDE_KW = [
    "bettwäsche", "handtuch", "socken", "jacke", "hose", "pullover",
    "schuh", "kleid", "pyjama", "tshirt", "t-shirt",
    "werkzeug", "pinsel", "bohrer", "schraube",
    "blume", "pflanze", "dünger", "erde", "hochbeet",
    "kissen", "decke", "bett", "lampe", "möbel", "keramik",
    "spielzeug", "spiel", "ball", "puppe",
    "shampoo", "duschgel", "zahnpasta", "seife", "lack", "creme",
    "waschmittel", "spülmittel", "klarspüler", "reiniger",
    "tasche", "koffer", "regenschirm", "verband",
    "katzenstreu", "hundebett", "tierfutter",
    "wein", "bier", "sekt", "prosecco", "vodka", "gin", "whisky",
    "fotobook", "poster", "bilderrahmen", "sonnenmilch",
    "arbeits-", "fleecejacke", "sneaker",
    "baumwolle", "viskose", "frottier", "jersey", "spannbetttuch",
    "obstbäume", "obstbaum", "rhododendron", "geranie", "kamelie",
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
    if any(k in n for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","bratwurst","schnitzel","nuggets","cordon","steak","braten","gulasch","schinken","speck","salami","metzgerei","wiener"]):
        return "fleisch"
    if any(k in n for k in ["lachs","forelle","dorade","thunfisch","garnelen","fisch","shrimps","backfisch"]):
        return "fisch"
    if any(k in n for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan","buttermilch","schmand"]):
        return "milchprodukte"
    if any(k in n for k in ["reis","nudeln","pasta","mehl","brot","toast","müsli","haferflocken","couscous","gnocchi","tortellini","linsen","bohnen"]):
        return "trockenwaren"
    if any(k in n for k in ["apfel","orange","banane","erdbeer","mango","mandarin","birne","kiwi","zitrone","traube","himbeer","heidelbeer","kirsche","avocado","dattel"]):
        return "obst"
    if any(k in n for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","chicoree","kohlrabi","spargel","tomate","zucchini","salat","spinat","brokkoli","blumenkohl","lauch","champignon","pilz","mais","kohl"]):
        return "gemuese"
    return "sonstiges"

def scrape():
    print(f"🔍 ALDI SÜD Scraper v3 — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    print("=" * 50)
    
    url = "https://www.aldi-sued.de/de/angebote.html"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        print(f"📡 {r.status_code} ({len(r.text):,} bytes)")
    except requests.RequestException as e:
        print(f"❌ {e}")
        return False
    
    if r.status_code != 200:
        return False
    
    # Extract clean text lines
    html = r.text
    text = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', html, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '\n', text)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    # Find final prices (not per-kg)
    # Pattern: line contains "X,XX €" but NOT "(X,XX €/...) "
    products = []
    
    for i, line in enumerate(lines):
        # Skip per-kg prices
        if re.search(r'\(.*€.*\)', line):
            continue
        # Skip the "²" marker line
        if line.strip() == '²':
            continue
        # Skip "Verfügbar seit/ab" lines
        if re.match(r'Verfügbar', line):
            continue
        
        # Match final price: just "X,XX €" optionally followed by "² Y,YY €"
        price_match = re.fullmatch(r'(\d+[,.]\d{2})\s*€(?:\s*²\s*(\d+[,.]\d{2})\s*€)?', line)
        if not price_match:
            continue
        
        price = float(price_match.group(1).replace(",", "."))
        old_price = float(price_match.group(2).replace(",", ".")) if price_match.group(2) else None
        
        if price < 0.10 or price > 50.00:
            continue
        
        # Look backwards for product name
        # Pattern: [Brand] → Product Name → Weight → (Price/kg) → Price
        name = ""
        for j in range(i-1, max(i-5, 0), -1):
            candidate = lines[j].strip()
            
            # Skip known patterns
            if candidate in BRANDS:
                continue
            if re.match(r'^\d+[,.]?\d*\s*(kg|g|ml|l|WL|Stück)$', candidate, re.IGNORECASE):
                continue
            if re.match(r'^\(.*€.*\)$', candidate):
                continue
            if candidate == '²':
                continue
            if re.match(r'^\d+[,.]\d{2}\s*€', candidate):
                continue
            if re.match(r'Verfügbar', candidate):
                continue
            if candidate in ['Tiefkühlung', 'Kühlung', 'Aktion', 'Vegan', 'Bio']:
                continue
            if len(candidate) < 3:
                continue
            if re.match(r'^[\d,.\s²€/]+$', candidate):
                continue
            
            # This should be the product name
            name = candidate
            
            # Check if line before is a brand → prepend
            if j > 0 and lines[j-1].strip() in BRANDS:
                name = lines[j-1].strip() + " " + name
            break
        
        if not name or len(name) < 3:
            continue
        
        # Food filter
        if not is_food(name):
            continue
        
        # Extract unit from name
        unit_match = re.search(r'(\d+(?:,\d+)?\s*(?:kg|g|ml|l|Stück))', name, re.IGNORECASE)
        unit = unit_match.group(1) if unit_match else ""
        
        products.append({
            "name": name,
            "price": price,
            "old_price": old_price,
            "unit": unit,
            "category": categorize(name),
        })
    
    # Deduplicate
    seen = set()
    unique = []
    for p in products:
        key = p["name"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(p)
    
    if not unique:
        print("❌ Keine Angebote gefunden!")
        return False
    
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    
    result = {
        "store": "ALDI SÜD",
        "date": today.strftime("%Y-%m-%d"),
        "valid_from": monday.strftime("%Y-%m-%d"),
        "valid_until": sunday.strftime("%Y-%m-%d"),
        "source": url,
        "offers": unique,
    }
    
    with open(OUTPUT, "w") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✅ {len(unique)} Angebote → {OUTPUT.name}\n")
    
    by_cat = {}
    for o in unique:
        by_cat.setdefault(o["category"], []).append(o)
    
    for cat in ["fleisch", "fisch", "milchprodukte", "obst", "gemuese", "trockenwaren", "sonstiges"]:
        items = by_cat.get(cat, [])
        if not items: continue
        print(f"  {cat.upper()} ({len(items)}):")
        for item in items:
            old = f" (war {item['old_price']:.2f}€)" if item.get("old_price") else ""
            print(f"    {item['name']}: {item['price']:.2f}€{old}")
    
    return True

if __name__ == "__main__":
    success = scrape()
    sys.exit(0 if success else 1)
