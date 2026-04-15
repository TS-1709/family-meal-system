#!/usr/bin/env python3
"""
Master Scraper — Führt alle Store-Scraper aus und merged die Ergebnisse.
Usage: python3 scrape_all.py [--merge-only]
"""
import subprocess, sys, json, re
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OFFERS_DIR = BASE / "offers"
OUTPUT = BASE / "current_offers.json"

# Ingredient normalization
NORM_MAP = {
    "hähnchenbrust": "hähnchen", "hähnchenbrustfilet": "hähnchen",
    "hähnchen filet": "hähnchen", "hähnchenschnitzel": "hähnchen",
    "putenbrust": "puten", "puten-schnitzel": "puten",
    "hackfleisch": "hackfleisch", "hackfleisch rind": "rinderhack",
    "hackfleisch vom rind": "rinderhack", "rinderhack": "rinderhack",
    "schweine-nackensteak": "schweinefleisch", "schweine-minutensteaks": "schweinefleisch",
    "lachsfilet": "lachs", "norwegisches lachsfilet": "lachs",
    "tomaten": "tomaten", "cocktailtomaten": "tomaten", "cocktailrispentomaten": "tomaten",
    "paprika": "paprika", "mix paprika": "paprika", "spitzpaprika": "paprika",
    "zwiebeln": "zwiebeln", "speisezwiebeln": "zwiebeln",
    "karotten": "karotten", "möhren": "karotten",
    "kartoffeln": "kartoffeln", "speisekartoffeln": "kartoffeln",
    "champignons": "pilze", "pilze": "pilze",
    "parmesan": "parmesan", "grana padano": "parmesan",
    "joghurt": "joghurt", "sahne": "sahne", "butter": "butter",
    "nudeln": "nudeln", "spaghetti": "spaghetti", "pasta": "nudeln",
    "basmatireis": "reis", "jasminreis": "reis", "reis": "reis",
    "olivenöl": "olivenöl", "kokosmilch": "kokosmilch",
    "erdbeeren": "erdbeeren", "banane": "banane", "bananen": "banane",
    "orangen": "orangen", "äpfel": "äpfel", "tafeläpfel": "äpfel",
    "tortellini": "tortellini", "rindfleisch-tortelloni": "tortellini",
    "delverde pasta": "nudeln", "barilla pasta": "nudeln",
    "barilla pesto rosso": "pesto", "barilla pasta sauce": "tomatensoße",
}

def normalize(name):
    n = name.lower().strip()
    for prefix in ["natur lieblinge", "bio naturland", "bestes aus der region",
                    "meine metzgerei", "golden seafood", "bio", "kühlung",
                    "rewe beste wähl", "rewe bio", "ja!", "bios",
                    "nur natur", "kleine schätze", "freshona", "milbona",
                    "sondey", "alesto", "combino", "dulano"]:
        if n.startswith(prefix):
            n = n[len(prefix):].strip().lstrip(",").strip()
    for key, val in NORM_MAP.items():
        if key in n: return val
    words = n.split()
    for w in words:
        if len(w) > 3 and w not in ["stück", "gramm", "je"]: return w
    return n[:20]

def categorize(name):
    n = name.lower()
    if any(k in n for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","bratwurst","schnitzel","nuggets","steak","braten","gulasch","schinken","speck","salami","metzgerei","wiener"]): return "fleisch"
    if any(k in n for k in ["lachs","fisch","garnelen","thunfisch","dorade","backfisch"]): return "fisch"
    if any(k in n for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan","buttermilch","grana","weichkäse","schnittkäse","frischkäse","scheiben"]): return "milchprodukte"
    if any(k in n for k in ["reis","nudeln","mehl","brot","toast","müsli","spaghetti","gnocchi","couscous","tortellini","pasta","pesto"]): return "trockenwaren"
    if any(k in n for k in ["apfel","äpfel","orange","banane","erdbeer","mango","mandarin","birne","kiwi","heidelbeer","avocado","zitrone","dattel"]): return "obst"
    if any(k in n for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","zucchini","spinat","brokkoli","tomate","blumenkohl","champignon","pilz","salat","spargel","lauch","kohlrabi","chicoree","mais"]): return "gemuese"
    return "sonstiges"

def run_scrapers():
    """Run all store scrapers."""
    scrapers = [
        ("ALDI SÜD", "scrape_aldi.py"),
        ("REWE", "scrape_rewe.py"),
        ("LIDL", "scrape_lidl.py"),
    ]
    results = {}
    for name, script in scrapers:
        print(f"\n{'='*40}")
        print(f"🔄 {name}...")
        try:
            r = subprocess.run([sys.executable, str(BASE / script)],
                             capture_output=True, text=True, timeout=30)
            if r.returncode == 0:
                print(r.stdout)
                results[name] = True
            else:
                print(f"⚠ {name}: {r.stderr[:200]}")
                results[name] = False
        except Exception as e:
            print(f"⚠ {name}: {e}")
            results[name] = False
    return results

def merge():
    """Merge all store offers into unified current_offers.json."""
    all_products = {}  # normalized_name → [{store, name, price, ...}]

    for fpath in sorted(OFFERS_DIR.glob("*.json")):
        with open(fpath) as f:
            data = json.load(f)
        store = data.get("store", fpath.stem)
        for o in data.get("offers", []):
            norm = normalize(o.get("name", ""))
            if not norm: continue
            entry = {"store": store, "name": o.get("name", ""),
                     "price": o.get("price", 0), "old_price": o.get("old_price"),
                     "unit": o.get("unit", ""),
                     "category": o.get("category", categorize(o.get("name", ""))),
                     "normalized": norm}
            all_products.setdefault(norm, []).append(entry)

    # Find cheapest per product
    comparison = []
    for norm, entries in all_products.items():
        cheapest = min(entries, key=lambda x: x["price"])
        comparison.append({
            "product": norm,
            "cheapest_store": cheapest["store"],
            "cheapest_price": cheapest["price"],
            "category": cheapest["category"],
            "offers": sorted([{"store": e["store"], "name": e["name"],
                              "price": e["price"], "old_price": e.get("old_price"),
                              "unit": e.get("unit", "")}
                             for e in entries], key=lambda x: x["price"]),
        })
    comparison.sort(key=lambda x: x["product"])

    flat = []
    for c in comparison:
        flat.append({
            "name": c["product"],
            "price": c["cheapest_price"],
            "old_price": c["offers"][0].get("old_price"),
            "unit": c["offers"][0].get("unit", ""),
            "category": c["category"],
            "store": c["cheapest_store"],
            "all_stores": c["offers"],
        })

    stores = list({c["cheapest_store"] for c in comparison})
    today = datetime.now()
    mon = today - timedelta(days=today.weekday())

    result = {
        "stores": stores,
        "date": today.strftime("%Y-%m-%d"),
        "valid_from": mon.strftime("%Y-%m-%d"),
        "valid_until": (mon + timedelta(days=5)).strftime("%Y-%m-%d"),
        "total_products": len(flat),
        "offers": flat,
        "comparison": comparison,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    # Stats
    savings = sum(
        max(e["price"] for e in c["offers"]) - min(e["price"] for e in c["offers"])
        for c in comparison if len(c["offers"]) > 1 and
        max(e["price"] for e in c["offers"]) - min(e["price"] for e in c["offers"]) > 0.3
    )

    print(f"\n{'='*40}")
    print(f"✅ GEMERGT: {len(stores)} Geschäfte, {len(flat)} Produkte")
    print(f"💰 Ersparnis durch Preisvergleich: bis zu {savings:.2f}€")
    print(f"\n📊 Produkte mit Preisunterschied:")
    for c in sorted(comparison, key=lambda x: -max(e['price'] for e in x['offers']) + min(e['price'] for e in x['offers']))[:10]:
        if len(c["offers"]) > 1:
            diff = max(e["price"] for e in c["offers"]) - min(e["price"] for e in c["offers"])
            if diff > 0.2:
                cheapest = c["offers"][0]
                print(f"  {c['product']:20} {cheapest['store']:10} {cheapest['price']:.2f}€  ← spart {diff:.2f}€")

    return result

def main():
    merge_only = "--merge-only" in sys.argv
    print(f"🛒 Multi-Store Scraper — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    OFFERS_DIR.mkdir(exist_ok=True)

    if not merge_only:
        run_scrapers()

    merge()

if __name__ == "__main__":
    main()
