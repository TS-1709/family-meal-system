#!/usr/bin/env python3
"""
ALDI SÜD Weekly Offer Scraper
Fetches current offers from aldi-sued.de and writes to current_offers.json.
Uses the __NUXT_DATA__ embedded in the HTML page.
"""

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests --break-system-packages")
    sys.exit(1)

BASE = Path(__file__).parent
OUTPUT_FILE = BASE / "current_offers.json"

def make_session() -> requests.Session:
    """Create a requests session with browser-like headers."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,"
                  "image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    })
    return s

# Category mapping: ALDI categories -> our categories
CATEGORY_MAP = {
    "fleisch": ["fleisch", "metzgerei", "schwein", "rind", "geflügel", "gefluegel",
                "hähnchen", "haehnchen", "pute", "hackfleisch", "bratwurst",
                "wurst", "aufschnitt", "schinken", "speck", "schnitzel",
                "cordon bleu", "nuggets"],
    "fisch": ["fisch", "lachs", "thunfisch", "garnelen", "shrimp", "meeresfrüchte",
              "meeresfruechte", "backfisch", "dorade", "forelle"],
    "milchprodukte": ["milchprodukte", "käse", "kaese", "milch", "joghurt", "butter",
                      "sahne", "quark", "eier", "mozzarella", "feta", "camembert",
                      "gouda", "emmentaler", "burrata", "cheddar", "grana padano",
                      "schmelzkäse", "schmelzkaese", "frischkäse", "frischkaese",
                      "weichkäse", "weichkaese", "hartkäse", "hartkaese",
                      "schnittkäse", "schnittkaese", "mascarpone", "ricotta",
                      "schmand", "sauerrahm"],
    "gemuese": ["gemüse", "gemuese", "karotten", "möhren", "moehren", "kartoffel",
                "zwiebel", "paprika", "tomate", "gurke", "zucchini", "brokkoli",
                "blumenkohl", "spinat", "salat", "champignons", "pilze",
                "lauch", "sellerie", "fenchel", "spargel", "chicoree",
                "kohlrabi", "aubergine", "kürbis", "kuerbis", "rotkohl",
                "weißkohl", "weisskohl", "rosenkohl", "bohnen", "erbsen",
                "linsen", "mais", "kürbiskerne", "edamame", "avocado",
                "cocktailrispentomaten", "rispentomaten", "lauchzwiebeln",
                "speisezwiebeln", "mangold", "rucola"],
    "obst": ["obst", "apfel", "äpfel", "aepfel", "birne", "banane", "orange",
             "mandarine", "clementine", "zitrone", "limette", "erdbeere",
             "himbeere", "heidelbeere", "blaubeere", "brombeere", "kirsche",
             "pflaume", "pfirsich", "nektarine", "aprikose", "mango",
             "ananas", "kiwi", "granatapfel", "drachenfrucht", "passionsfrucht",
             "wassermelone", "melone", "traube", "weintraube"],
    "trockenwaren": ["reis", "nudel", "pasta", "mehl", "zucker", "linsen",
                     "bohnen", "müsli", "muesli", "cornflakes", "haferflocken",
                     "brot", "toast", "brötchen", "broetchen", "baguette",
                     "mehl", "grieß", "griess", "couscous", "bulgur",
                     "polenta", "quinoa", "hirse", "flocken", "knäckebrot",
                     "knaeckebrot", "zwieback", "reiswaffel", "vitalis"],
}

# Non-food category keywords to exclude
NON_FOOD_KEYWORDS = [
    "bettwäsche", "bettwaesche", "kissen", "decke", "handtuch", "frottier",
    "socken", "kleidung", "jacke", "hose", "schuh", "pullover",
    "garten", "pflanze", "blume", "rhododendron", "baum", "strauch",
    "möbel", "moebel", "sessel", "tisch", "schirm", "regal",
    "farbe", "lack", "pinsel", "bürste", "buerste",
    "kfz", "auto", "verbandstasche",
    "hund", "katze", "tier", "streu", "futter",
    "spielzeug", "basteln", "diy",
    "waschmittel", "spülmittel", "spuelmittel", "putzmittel", "reiniger",
    "shampoo", "duschgel", "deo", "deodorant", "pflege", "kosmetik",
    "nagellack", "make-up", "makeup", "creme", "lotion",
    "koffer", "tasche", "rucksack",
    "kerze", "deko", "dekoartikel",
    "werkzeug", "bohrer", "schraube",
]


def classify_category(name: str, aldi_categories: list[str]) -> str:
    """Classify a product into our food categories."""
    name_lower = name.lower()
    cat_lower = " ".join(c.lower() for c in aldi_categories)

    # Check if non-food
    for kw in NON_FOOD_KEYWORDS:
        if kw in name_lower or kw in cat_lower:
            return ""

    combined = name_lower + " " + cat_lower

    # Special case: check ALDI subcategories for fish before meat
    # "Fisch & Meeresfrüchte" subcategory should always be "fisch"
    for ac in aldi_categories:
        ac_l = ac.lower()
        if "fisch" in ac_l and "fleisch" not in ac_l:
            return "fisch"
        if "meeresfr" in ac_l:
            return "fisch"

    # Check categories in priority order (most specific first)
    for our_cat, keywords in CATEGORY_MAP.items():
        for kw in keywords:
            if kw in combined:
                return our_cat

    # Default: if it's in Wochenangebote and not caught above, it might be food
    if "wochenangebot" in cat_lower or "frischeprodukt" in cat_lower:
        return "sonstiges"

    return ""


def parse_was_price(display: str | None) -> float | None:
    """Parse German old price display like '1,99 €' to float."""
    if not display:
        return None
    # Extract number from strings like "1,99 €", "5,79 €"
    m = re.search(r"(\d+),(\d+)\s*€", display)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")
    return None


def extract_unit(selling_size: str | None, name: str) -> str:
    """Extract unit/size from selling_size or product name."""
    if selling_size:
        # Normalize: "0,5 kg" -> "500g", "2 kg" -> "2kg"
        s = selling_size.strip()
        # Convert kg to g
        m = re.match(r"(\d+(?:,\d+)?)\s*kg", s)
        if m:
            kg = float(m.group(1).replace(",", "."))
            if kg == int(kg):
                return f"{int(kg * 1000)}g"
            return f"{int(kg * 1000)}g"
        # Convert l to ml
        m = re.match(r"(\d+(?:,\d+)?)\s*l\b", s)
        if m:
            l_val = float(m.group(1).replace(",", "."))
            if l_val < 1:
                return f"{int(l_val * 1000)}ml"
            return f"{l_val}l"
        return s

    # Try to extract from name
    m = re.search(r"(\d+(?:,\d+)?)\s*(g|kg|ml|l|cl|stk|stück|st)\b", name, re.IGNORECASE)
    if m:
        return m.group(0).replace("stück", "Stk").replace("Stück", "Stk")
    return ""


def resolve_nuxt_data(data: list) -> list[dict]:
    """Parse Nuxt 3 __NUXT_DATA__ flat array into product objects."""

    def resolve(idx: int, depth: int = 0):
        if depth > 30 or idx is None or not isinstance(idx, int) or idx < 0 or idx >= len(data):
            return None
        item = data[idx]
        if isinstance(item, dict):
            return {k: resolve(v, depth + 1) for k, v in item.items()}
        elif isinstance(item, list):
            if (len(item) == 2 and isinstance(item[0], str)
                    and item[0] in ("ShallowReactive", "ShallowRef", "Reactive", "Ref")):
                return resolve(item[1], depth + 1)
            return [resolve(i, depth + 1) for i in item]
        return item

    products = []

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            continue
        if not all(k in item for k in ("sku", "name", "price", "variants")):
            continue

        # Get raw values (indices into flat array)
        name_idx = item["name"]
        price_idx = item["price"]
        selling_size_idx = item.get("sellingSize")
        categories_idx = item.get("categories")
        brand_idx = item.get("brandName")

        # Resolve name
        name = data[name_idx] if isinstance(name_idx, int) and name_idx >= 0 else None
        if not name or not isinstance(name, str):
            continue

        # Resolve brand
        brand = data[brand_idx] if isinstance(brand_idx, int) and brand_idx >= 0 else None

        # Resolve price
        price_data = data[price_idx] if isinstance(price_idx, int) and price_idx >= 0 else {}
        amount = None
        was_price_display = None
        if isinstance(price_data, dict):
            amount_idx = price_data.get("amount")
            amount = data[amount_idx] if isinstance(amount_idx, int) and amount_idx >= 0 else None
            was_idx = price_data.get("wasPriceDisplay")
            was_price_display = data[was_idx] if isinstance(was_idx, int) and was_idx >= 0 else None

        if amount is None:
            continue

        # Resolve selling size
        selling_size = None
        if isinstance(selling_size_idx, int) and selling_size_idx >= 0:
            selling_size = data[selling_size_idx]

        # Resolve categories
        cats = []
        if isinstance(categories_idx, int) and categories_idx >= 0:
            cat_list = data[categories_idx]
            if isinstance(cat_list, list):
                for cidx in cat_list:
                    if isinstance(cidx, int) and cidx >= 0:
                        cat_obj = data[cidx]
                        if isinstance(cat_obj, dict) and "name" in cat_obj:
                            cn = data[cat_obj["name"]] if isinstance(cat_obj["name"], int) else None
                            if cn:
                                cats.append(cn)

        # Build full display name
        full_name = f"{brand} {name}" if brand and brand not in name else name

        products.append({
            "name": full_name,
            "price": round(amount / 100, 2),
            "old_price_display": was_price_display,
            "selling_size": selling_size,
            "aldi_categories": cats,
        })

    return products


def fetch_page(session: requests.Session, url: str) -> str | None:
    """Fetch a page and return HTML text, or None on failure."""
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  Failed to fetch {url}: {e}")
        return None


def extract_nuxt_data(html: str) -> list | None:
    """Extract __NUXT_DATA__ JSON array from HTML."""
    match = re.search(r'id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def extract_validity_dates(html: str, nuxt_data: list) -> tuple[str, str]:
    """Extract the offer validity date range from page content."""
    # Try to find date range in text like "Mo., 13.4. – Sa., 18.4."
    date_pattern = r"(\d{1,2})\.(\d{1,2})\.\s*[–-]\s*(?:Sa\.?,?\s*)?(\d{1,2})\.(\d{1,2})\."
    m = re.search(date_pattern, html)
    if m:
        d1, m1, d2, m2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        year = datetime.now().year
        valid_from = f"{year}-{m1:02d}-{d1:02d}"
        valid_until = f"{year}-{m2:02d}-{d2:02d}"
        return valid_from, valid_until

    # Fallback: compute based on current date
    # ALDI SÜD weekly offers typically run Monday to Saturday
    today = datetime.now()
    # Find the Monday of this week
    monday = today - timedelta(days=today.weekday())
    saturday = monday + timedelta(days=5)
    return monday.strftime("%Y-%m-%d"), saturday.strftime("%Y-%m-%d")


def scrape() -> dict | None:
    """Main scraping function. Returns the offers dict or None on failure."""

    # URLs to try in order
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())

    urls_to_try = [
        "https://www.aldi-sued.de/de/angebote.html",
        f"https://www.aldi-sued.de/de/angebote/d.{monday.strftime('%d-%m-%Y')}.html",
        # Slug-based: "angebote-ab-montag-DD-MONTHNAME/"
        f"https://www.aldi-sued.de/de/angebote/angebote-ab-montag-{monday.day}-{monday.strftime('%B').lower()}/",
    ]

    # Create session and warm up with main page visit
    session = make_session()
    print("Warming up session...")
    try:
        session.get("https://www.aldi-sued.de/", timeout=30)
    except Exception as e:
        print(f"  Warning: Main page visit failed: {e}")

    html = None
    source_url = None
    for url in urls_to_try:
        print(f"Trying: {url}")
        html = fetch_page(session, url)
        if html and extract_nuxt_data(html):
            source_url = url
            print(f"  Success ({len(html)} bytes)")
            break
        print(f"  No Nuxt data found")

    if not html:
        print("ERROR: Could not fetch any ALDI SÜD offers page")
        return None

    nuxt_data = extract_nuxt_data(html)
    if not nuxt_data:
        print("ERROR: Failed to parse __NUXT_DATA__")
        return None

    # Extract validity dates
    valid_from, valid_until = extract_validity_dates(html, nuxt_data)

    # Extract products
    raw_products = resolve_nuxt_data(nuxt_data)
    print(f"Found {len(raw_products)} raw products")

    # Filter to food items and classify
    offers = []
    for p in raw_products:
        category = classify_category(p["name"], p["aldi_categories"])
        if not category:
            continue  # Skip non-food items

        old_price = parse_was_price(p["old_price_display"])
        unit = extract_unit(p["selling_size"], p["name"])

        offers.append({
            "name": p["name"],
            "price": p["price"],
            "old_price": old_price,
            "unit": unit,
            "category": category,
        })

    print(f"Filtered to {len(offers)} food offers")

    result = {
        "store": "ALDI SÜD",
        "date": today.strftime("%Y-%m-%d"),
        "valid_from": valid_from,
        "valid_until": valid_until,
        "source": "aldi-sued.de",
        "offers": offers,
    }

    return result


def main():
    print(f"ALDI SÜD Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 50)

    # Load existing data as fallback
    existing = None
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE) as f:
                existing = json.load(f)
            print(f"Existing offers file: {len(existing.get('offers', []))} offers from {existing.get('date', '?')}")
        except Exception as e:
            print(f"Warning: Could not load existing offers: {e}")

    # Scrape
    result = scrape()

    if result and result.get("offers"):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved {len(result['offers'])} offers to {OUTPUT_FILE}")
        print(f"  Valid: {result['valid_from']} to {result['valid_until']}")

        # Print summary by category
        cats = {}
        for o in result["offers"]:
            cats[o["category"]] = cats.get(o["category"], 0) + 1
        print("  By category:")
        for c, n in sorted(cats.items()):
            print(f"    {c}: {n}")

        # Print some highlights (items with old_price = on sale)
        on_sale = [o for o in result["offers"] if o.get("old_price")]
        if on_sale:
            print(f"\n  🔥 {len(on_sale)} items on sale:")
            for o in on_sale[:10]:
                saving = o["old_price"] - o["price"]
                print(f"    {o['name']}: {o['price']}€ (was {o['old_price']}€, save {saving:.2f}€)")
    else:
        print("\n⚠ Scraping returned no offers!")
        if existing:
            print(f"  Keeping existing data ({len(existing.get('offers', []))} offers)")
        else:
            print("  No existing data to fall back to either!")
            # Write empty structure so the system doesn't crash
            fallback = {
                "store": "ALDI SÜD",
                "date": datetime.now().strftime("%Y-%m-%d"),
                "valid_from": "",
                "valid_until": "",
                "source": "aldi-sued.de",
                "offers": [],
            }
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump(fallback, f, indent=2, ensure_ascii=False)
            print("  Written empty fallback file")
        sys.exit(1)


if __name__ == "__main__":
    main()
