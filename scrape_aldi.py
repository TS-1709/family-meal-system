#!/usr/bin/env python3
"""
ALDI SÜD Offer Scraper — Extracts weekly offers from aldi-sued.de
Uses __NEXT_DATA__ JSON embedded in HTML (Next.js SSR).
Falls back to HTML text parsing if __NEXT_DATA__ is unavailable.
Outputs to current_offers.json for the meal planner.
"""

import json, re, sys, os
from datetime import datetime, timedelta
from urllib.request import urlopen, Request
from urllib.error import URLError

BASE = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(BASE, "current_offers.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept-Language": "de-DE,de;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def fetch(url):
    """Fetch URL with timeout and headers."""
    req = Request(url, headers=HEADERS)
    try:
        with urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except URLError as e:
        print(f"  ⚠ {url}: {e}")
        return None

def extract_next_data(html):
    """Extract __NEXT_DATA__ JSON from Next.js pages."""
    match = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Alternative: look for inline script with JSON
    match = re.search(r'__NEXT_DATA__\s*=\s*(\{.*?\})\s*;?\s*</script>', html, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return None

def extract_offers_from_next_data(data):
    """Navigate __NEXT_DATA__ structure to find product offers."""
    offers = []
    
    def walk(obj, depth=0):
        if depth > 15 or len(offers) > 200:
            return
        if isinstance(obj, dict):
            # Check if this looks like a product
            name = obj.get("name", "") or obj.get("productName", "") or obj.get("title", "")
            price = obj.get("price", obj.get("currentPrice", obj.get("salesPrice")))
            if name and price is not None:
                try:
                    price_val = float(str(price).replace(",", ".").replace("€", "").strip())
                    old_price = obj.get("oldPrice", obj.get("regularPrice", obj.get("strikethroughPrice")))
                    old_val = None
                    if old_price:
                        try:
                            old_val = float(str(old_price).replace(",", ".").replace("€", "").strip())
                        except (ValueError, TypeError):
                            pass
                    unit = obj.get("unit", obj.get("packagingSize", ""))
                    if isinstance(unit, dict):
                        unit = unit.get("label", "")
                    offers.append({
                        "name": str(name).strip(),
                        "price": price_val,
                        "old_price": old_val,
                        "unit": str(unit).strip() if unit else "",
                    })
                except (ValueError, TypeError):
                    pass
            for v in obj.values():
                walk(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, depth + 1)
    
    walk(data)
    return offers

def extract_offers_from_html(html):
    """Fallback: parse offers from raw HTML text."""
    from html.parser import HTMLParser
    
    class TextExtractor(HTMLParser):
        def __init__(self):
            super().__init__()
            self.text = []
            self.skip = False
        def handle_starttag(self, tag, attrs):
            if tag in ('script', 'style'):
                self.skip = True
        def handle_endtag(self, tag):
            if tag in ('script', 'style'):
                self.skip = False
        def handle_data(self, data):
            if not self.skip:
                self.text.append(data)
    
    parser = TextExtractor()
    parser.feed(html)
    full_text = " ".join(parser.text)
    
    # Find price patterns: "Product Name 1,23 €"
    offers = []
    # Pattern: name followed by price with €
    pattern = re.compile(
        r'([A-ZÄÖÜ][\w\s\-\.]{5,60}?)\s+'  # Product name
        r'(\d+[,.]\d{2})\s*€',              # Price
        re.UNICODE
    )
    for match in pattern.finditer(full_text):
        name = match.group(1).strip()
        price = float(match.group(2).replace(",", "."))
        
        # Skip non-food items
        skip_words = ['cookie', 'browser', 'javascript', 'html', 'css', 'font']
        if any(w in name.lower() for w in skip_words):
            continue
        
        # Try to find old price in parentheses
        rest = full_text[match.end():match.end()+30]
        old_match = re.search(r'(\d+[,.]\d{2})\s*€', rest)
        old_price = float(old_match.group(1).replace(",", ".")) if old_match else None
        
        offers.append({
            "name": name,
            "price": price,
            "old_price": old_price,
            "unit": "",
        })
    
    return offers

def categorize(name):
    """Auto-categorize product for meal matching."""
    n = name.lower()
    if any(k in n for k in ["hähnchen", "huhn", "hackfleisch", "schwein", "rind", "bratwurst", "nacken", "schnitzel", "cordon", "nuggets", "wiener"]):
        return "fleisch"
    if any(k in n for k in ["lachs", "fisch", "garnelen", "thunfisch", "dorade", "forelle"]):
        return "fisch"
    if any(k in n for k in ["joghurt", "butter", "milch", "käse", "sahne", "quark", "feta", "mozzarella", "parmesan"]):
        return "milchprodukte"
    if any(k in n for k in ["reis", "nudeln", "mehl", "brot", "spaghetti", "penne", "gnocchi", "couscous"]):
        return "trockenwaren"
    if any(k in n for k in ["apfel", "orange", "banane", "erdbeer", "mango", "mandarin", "birne", "zitrone", "kiwi", "himbeer"]):
        return "obst"
    if any(k in n for k in ["paprika", "kartoffel", "zwiebel", "karotte", "möhre", "gurke", "zucchini", "spinat", "brokkoli", "tomate", "blumenkohl", "spargel", "kohlrabi", "chicoree", "lauch"]):
        return "gemuese"
    if any(k in n for k in ["öl", "essig", "soße", "ketchup", "senf", "mayo", "pesto", "honig", "marmelade"]):
        return "sonstiges"
    return "sonstiges"

def scrape():
    """Main scraper: fetch ALDI SÜD offers and save to JSON."""
    print(f"🔍 ALDI SÜD Scraper — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    
    # Build URL candidates (ALDI changes URLs frequently)
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    
    urls = [
        "https://www.aldi-sued.de/de/angebote.html",
        f"https://www.aldi-sued.de/de/angebote/d.{monday.strftime('%d-%m-%Y')}.html",
    ]
    # Add next Monday too
    next_monday = monday + timedelta(days=7)
    urls.append(f"https://www.aldi-sued.de/de/angebote/d.{next_monday.strftime('%d-%m-%Y')}.html")
    
    all_offers = []
    
    for url in urls:
        print(f"\n📥 {url}")
        html = fetch(url)
        if not html or len(html) < 1000:
            continue
        
        print(f"  {len(html):,} bytes")
        
        # Try __NEXT_DATA__ first
        next_data = extract_next_data(html)
        if next_data:
            print(f"  ✅ __NEXT_DATA__ found")
            offers = extract_offers_from_next_data(next_data)
            if offers:
                print(f"  → {len(offers)} products from JSON")
                all_offers.extend(offers)
                break  # Got data, no need to try more URLs
            else:
                print(f"  ⚠ No products in JSON, trying HTML fallback...")
        
        # Fallback: HTML text parsing
        offers = extract_offers_from_html(html)
        if offers:
            print(f"  → {len(offers)} products from HTML")
            all_offers.extend(offers)
    
    # Deduplicate by name
    seen = set()
    unique = []
    for o in all_offers:
        key = o["name"].lower().strip()
        if key not in seen and len(key) > 2:
            seen.add(key)
            o["category"] = categorize(o["name"])
            unique.append(o)
    
    if not unique:
        print("\n⚠ Keine Angebote gefunden! Prüfe die URL oder die Seitenstruktur.")
        return False
    
    # Calculate validity dates
    valid_from = monday.strftime("%Y-%m-%d")
    valid_until = (monday + timedelta(days=6)).strftime("%Y-%m-%d")
    
    result = {
        "store": "ALDI SÜD",
        "date": today.strftime("%Y-%m-%d"),
        "valid_from": valid_from,
        "valid_until": valid_until,
        "source": "aldi-sued.de",
        "scraped_at": today.isoformat(),
        "offers": unique,
    }
    
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # Summary
    by_cat = {}
    for o in unique:
        by_cat.setdefault(o["category"], []).append(o)
    
    print(f"\n✅ {len(unique)} Angebote gespeichert → {OUTPUT}")
    for cat, items in sorted(by_cat.items()):
        print(f"\n  {cat.upper()} ({len(items)}):")
        for i in items[:5]:
            old = f" (war {i['old_price']:.2f}€)" if i.get("old_price") else ""
            print(f"    {i['name'][:45]}: {i['price']:.2f}€{old}")
        if len(items) > 5:
            print(f"    ... +{len(items)-5} mehr")
    
    return True

if __name__ == "__main__":
    success = scrape()
    sys.exit(0 if success else 1)
