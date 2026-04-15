#!/usr/bin/env python3
"""
Multi-Store Offer Scraper v2 — Parses marktguru.de HTML for ALDI SÜD, LIDL, REWE.
"""

import re, json, sys
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError
from html.parser import HTMLParser

BASE = Path(__file__).parent.parent
OFFERS_DIR = BASE / "data" / "offers"
OFFERS_DIR.mkdir(parents=True, exist_ok=True)

STORES = {
    "aldi_sued": {"url": "https://www.marktguru.de/r/aldi-sued", "name": "ALDI SÜD"},
    "lidl": {"url": "https://www.marktguru.de/r/lidl", "name": "LIDL"},
    "rewe": {"url": "https://www.marktguru.de/r/rewe", "name": "REWE"},
}

FOOD_KW = {
    "hähnchen","huhn","schwein","rind","hackfleisch","lachs","thunfisch","fisch",
    "garnelen","bratwurst","schnitzel","puten","nacken","gulasch","wurst","speck",
    "schinken","nuggets","frikadellen","bockwurst","kebab","rindfleisch",
    "milch","butter","käse","joghurt","sahne","quark","eier","feta","mozzarella",
    "parmesan","schmand","ricotta","camembert","gruyère","emmentaler",
    "nudeln","pasta","spaghetti","penne","reis","mehl","brot","brötchen",
    "gnocchi","tortellini","maultaschen","couscous","flocken","linguine","müsli",
    "tomaten","paprika","zwiebeln","kartoffel","möhren","karotten","gurke",
    "zucchini","spinat","brokkoli","blumenkohl","salat","avocado","zitrone",
    "kürbis","bohnen","linsen","kichererbsen","erbsen","mais","champignons",
    "pilze","lauch","sellerie","spargel","kohlrabi","chicoree",
    "apfel","banane","erdbeer","orange","mango","birne","kiwi","himbeer",
    "olivenöl","sojasauce","tomatensoße","kokosmilch","pesto","brühe","essig",
    "senf","ketchup","mayo","honig","marmelade","apfelmus",
    "magnum","eis","schokolade","joghurt",
}

CAT_MAP = {
    "fleisch": ["hähnchen","huhn","schwein","rind","hackfleisch","bratwurst","schnitzel","puten","nacken","gulasch","wurst","speck","schinken","nuggets","frikadellen","bockwurst","kebab","rindfleisch","metzger"],
    "fisch": ["lachs","thunfisch","fisch","garnelen","stremellachs","räucherlachs"],
    "milchprodukte": ["milch","butter","käse","joghurt","sahne","quark","eier","feta","mozzarella","parmesan","schmand","ricotta","camembert","emmentaler","gruyère"],
    "trockenwaren": ["nudeln","pasta","spaghetti","penne","reis","mehl","brot","brötchen","gnocchi","tortellini","maultaschen","couscous","flocken","linguine","müsli"],
    "gemuese": ["tomaten","paprika","zwiebeln","kartoffel","möhren","karotten","gurke","zucchini","spinat","brokkoli","blumenkohl","salat","avocado","zitrone","kürbis","bohnen","linsen","kichererbsen","erbsen","mais","champignons","pilze","lauch","sellerie","spargel","kohlrabi","chicoree"],
    "obst": ["apfel","banane","erdbeer","orange","mango","birne","kiwi","himbeer"],
}

def is_food(name):
    n = name.lower()
    return any(kw in n for kw in FOOD_KW)

def categorize(name):
    n = name.lower()
    for cat, keywords in CAT_MAP.items():
        if any(k in n for k in keywords):
            return cat
    return "sonstiges"

def clean_html(text):
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def scrape_store(store_key, store_config):
    url = store_config["url"]
    print(f"Scraping {store_config['name']}...")
    
    try:
        req = Request(url, headers={
            "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
            "Accept-Language": "de-DE,de;q=0.9",
        })
        with urlopen(req, timeout=20) as r:
            html = r.read().decode("utf-8", errors="replace")
    except Exception as e:
        print(f"  Error: {e}")
        return []
    
    offers = []
    
    # Find all price spans and extract context before each
    for match in re.finditer(r'<span class="price">(€\s*[\d,.]+)</span>', html):
        price_text = match.group(1)
        price_val = float(re.search(r'[\d,.]+', price_text).group().replace(",", "."))
        
        # Get 1500 chars before the price for product info
        start = max(0, match.start() - 1500)
        context = html[start:match.start()]
        clean = clean_html(context)
        
        # Extract product name - look for text after "Marke:" backwards
        # Pattern: "ProductName Marke: BrandName Preis:"
        name = ""
        brand = ""
        
        # Try to find the product name (text before "Marke:")
        marke_match = list(re.finditer(r'(.+?)\s*Marke:\s*(\S[\w\s]*?)(?:\s*Preis:|\s*$)', clean))
        if marke_match:
            last_match = marke_match[-1]
            name = last_match.group(1).strip()
            brand = last_match.group(2).strip()
        else:
            # Fallback: last meaningful text before price
            parts = clean.split("Preis:")
            if parts:
                before_price = parts[-1] if len(parts) > 1 else parts[0]
                # Get last line-like chunk
                words = before_price.strip().split()
                name = " ".join(words[-5:]) if len(words) > 5 else before_price.strip()
        
        # Clean up name - remove store navigation artifacts
        for noise in ["P Prospekte", "Discounter", "Angebote", "Lidl Angebote", "ALDI SÜD Angebote", "REWE Angebote"]:
            name = name.replace(noise, "").strip()
        
        if not name or len(name) < 2:
            continue
        
        if not is_food(name):
            continue
        
        # Extract unit price info (after the main price)
        after_price = html[match.end():match.end()+300]
        after_clean = clean_html(after_price)
        
        unit_match = re.search(r'€\s*([\d,.]+)\s*/\s*(\w+)', after_clean)
        unit_price = float(unit_match.group(1).replace(",", ".")) if unit_match else None
        unit = unit_match.group(2) if unit_match else ""
        
        qty_match = re.search(r'Je\s+(\d+\s*(?:g|kg|ml|l|Stk|x\d+))', after_clean, re.IGNORECASE)
        qty = qty_match.group(1) if qty_match else ""
        
        # Extract validity
        valid_match = re.search(r'Gültig:\s*(\d+\.\d+\.)\s*-\s*(\d+\.\d+\.)', after_clean)
        valid_from = valid_match.group(1) if valid_match else ""
        valid_until = valid_match.group(2) if valid_match else ""
        
        # Extract discount
        discount_match = re.search(r'-(\d+)%', clean[-100:])
        discount_pct = int(discount_match.group(1)) if discount_match else None
        
        # Extract old price
        old_price = None
        old_match = re.search(r'(\d+[,.]\d{2})\s*$', clean[-50:])
        if old_match:
            potential_old = float(old_match.group(1).replace(",", "."))
            if potential_old > price_val:
                old_price = potential_old
        
        offers.append({
            "name": name,
            "brand": brand,
            "price": price_val,
            "old_price": old_price,
            "discount_pct": discount_pct,
            "unit": unit,
            "quantity": qty,
            "category": categorize(name),
            "store": store_config["name"],
            "store_key": store_key,
            "valid_from": valid_from,
            "valid_until": valid_until,
        })
    
    # Deduplicate
    seen = set()
    unique = []
    for o in offers:
        key = f"{o['name'].lower()}_{o['price']}"
        if key not in seen:
            seen.add(key)
            unique.append(o)
    
    print(f"  Found {len(unique)} food offers")
    return unique

def main():
    kw = datetime.now().isocalendar()[1]
    all_offers = {}
    
    for store_key, store_config in STORES.items():
        offers = scrape_store(store_key, store_config)
        all_offers[store_key] = offers
        
        outpath = OFFERS_DIR / f"{store_key}.json"
        with open(outpath, "w") as f:
            json.dump({
                "store": store_config["name"],
                "date": datetime.now().strftime("%Y-%m-%d"),
                "kw": kw,
                "offer_count": len(offers),
                "offers": offers,
            }, f, ensure_ascii=False, indent=2)
        print(f"  Saved: {outpath}")
    
    # Combined
    combined = {
        "date": datetime.now().strftime("%Y-%m-%d"),
        "kw": kw,
        "stores": {k: {"name": v["name"], "count": len(all_offers[k])} for k, v in STORES.items()},
        "total": sum(len(v) for v in all_offers.values()),
        "all_offers": [],
    }
    for offers in all_offers.values():
        combined["all_offers"].extend(offers)
    
    with open(OFFERS_DIR / "all_stores.json", "w") as f:
        json.dump(combined, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== SUMMARY KW{kw} ===")
    for k, v in STORES.items():
        print(f"  {v['name']}: {len(all_offers[k])} food offers")
    print(f"  Total: {combined['total']}")
    
    # Show sample
    for store_key, offers in all_offers.items():
        if offers:
            print(f"\n  {STORES[store_key]['name']} top 5:")
            for o in offers[:5]:
                old = f" (war {o['old_price']:.2f}€)" if o.get("old_price") else ""
                disc = f" -{o['discount_pct']}%" if o.get("discount_pct") else ""
                print(f"    {o['name']}: {o['price']:.2f}€{old}{disc}")

if __name__ == "__main__":
    main()
