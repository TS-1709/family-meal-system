#!/usr/bin/env python3
"""
ALDI SÜD Weekly Offer Scraper
Fetches current offers from aldi-sued.de and writes to current_offers.json.
Supports both __NEXT_DATA__ (Next.js) and __NUXT_DATA__ (Nuxt 3) formats.
"""

import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print("ERROR: 'requests' and 'beautifulsoup4' required. Run: pip install requests beautifulsoup4 --break-system-packages")
    sys.exit(1)

BASE = Path(__file__).parent
OUTPUT_FILE = BASE / "current_offers.json"

# --- Session & Headers ---

def make_session() -> requests.Session:
    """Create a requests session with mobile browser headers."""
    s = requests.Session()
    s.headers.update({
        "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Cache-Control": "max-age=0",
    })
    return s


# --- Category Classification ---

CATEGORY_MAP = {
    "fleisch": [
        "fleisch", "metzgerei", "schwein", "rind", "geflügel", "gefluegel",
        "hähnchen", "haehnchen", "huhn", "pute", "hackfleisch", "bratwurst",
        "wurst", "aufschnitt", "schinken", "speck", "schnitzel",
        "cordon bleu", "nuggets", "steak", "filet", "keule", "braten",
        "salami", "mortadella", "pastrami", "chorizo",
    ],
    "fisch": [
        "fisch", "lachs", "thunfisch", "garnelen", "shrimp", "meeresfrüchte",
        "meeresfruechte", "backfisch", "dorade", "forelle", "makrele",
        "hering", "seelachs", "kabeljau", "scholle", "zander", "hecht",
        "muschel", "tintenfisch", "krabbe", "hummer",
    ],
    "milchprodukte": [
        "milchprodukte", "käse", "kaese", "milch", "joghurt", "butter",
        "sahne", "quark", "eier", "mozzarella", "feta", "camembert",
        "gouda", "emmentaler", "burrata", "cheddar", "grana padano",
        "schmelzkäse", "schmelzkaese", "frischkäse", "frischkaese",
        "weichkäse", "weichkaese", "hartkäse", "hartkaese",
        "schnittkäse", "schnittkaese", "mascarpone", "ricotta",
        "schmand", "sauerrahm", "speisequark", "buttermilch",
        "frischkäsezubereitung", "frischkaesezubereitung",
    ],
    "gemuese": [
        "gemüse", "gemuese", "karotten", "möhren", "moehren", "kartoffel",
        "zwiebel", "paprika", "tomate", "gurke", "zucchini", "brokkoli",
        "blumenkohl", "spinat", "salat", "champignons", "pilze",
        "lauch", "sellerie", "fenchel", "spargel", "chicoree",
        "kohlrabi", "aubergine", "kürbis", "kuerbis", "rotkohl",
        "weißkohl", "weisskohl", "rosenkohl", "bohnen", "erbsen",
        "linsen", "mais", "edamame", "avocado",
        "cocktailrispentomaten", "rispentomaten", "lauchzwiebeln",
        "speisezwiebeln", "mangold", "rucola", "süßkartoffel",
    ],
    "obst": [
        "obst", "apfel", "äpfel", "aepfel", "birne", "banane", "orange",
        "mandarine", "clementine", "zitrone", "limette", "erdbeere",
        "himbeere", "heidelbeere", "blaubeere", "brombeere", "kirsche",
        "pflaume", "pfirsich", "nektarine", "aprikose", "mango",
        "ananas", "kiwi", "granatapfel", "drachenfrucht", "passionsfrucht",
        "wassermelone", "melone", "traube", "weintraube", "quitte",
        "feige", "dattel", "getrocknet",
    ],
    "trockenwaren": [
        "reis", "nudel", "pasta", "mehl", "zucker", "müsli", "muesli",
        "cornflakes", "haferflocken", "brot", "toast", "brötchen", "broetchen",
        "baguette", "grieß", "griess", "couscous", "bulgur",
        "polenta", "quinoa", "hirse", "flocken", "knäckebrot",
        "knaeckebrot", "zwieback", "reiswaffel", "vitalis", "salz",
        "pfeffer", "gewürz", "gewuerz", "öl", "olivenöl", "essig",
        "soße", "soße", "sauce", "ketchup", "mayo", "senf",
        "honig", "marmelade", "nutella", "aufstrich",
        "dose", "konserven", "tomaten passiert", "kokosmilch",
        "mehl", "backpulver", "vanille", "kakao",
    ],
}

# Non-food keywords to exclude
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
    "leder", "textil", "hemd", "tshirt", "t-shirt", "unterwäsche",
    "sonnenbrille", "uhr", "schmuck", "kette", "ring",
    "dvd", "blu-ray", "spielkonsole", "headphone", "kopfhörer",
    "lautsprecher", "kabel", "ladegerät", "akku", "batterie",
    "drucker", "tinte", "papier", "büro",
]


def classify_category(name: str, aldi_categories: list[str]) -> str:
    """Classify a product into our food categories. Returns empty string for non-food."""
    name_lower = name.lower()
    cat_lower = " ".join(c.lower() for c in aldi_categories)

    # Check non-food first
    combined_check = name_lower + " " + cat_lower
    for kw in NON_FOOD_KEYWORDS:
        if kw in combined_check:
            return ""

    combined = name_lower + " " + cat_lower

    # Special: ALDI subcategory overrides
    for ac in aldi_categories:
        ac_l = ac.lower()
        if "fisch" in ac_l and "fleisch" not in ac_l:
            return "fisch"
        if "meeresfr" in ac_l:
            return "fisch"

    # Check categories in priority order
    for our_cat, keywords in CATEGORY_MAP.items():
        for kw in keywords:
            if kw in combined:
                return our_cat

    # Fallback: if it's in Wochenangebote or Frischeprodukte, treat as sonstiges
    if "wochenangebot" in cat_lower or "frischeprodukt" in cat_lower:
        return "sonstiges"

    return ""


# --- Price Parsing ---

def parse_was_price(display: str | None) -> float | None:
    """Parse German old price display like '1,99 €' to float."""
    if not display:
        return None
    m = re.search(r"(\d+),(\d+)\s*€", display)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")
    return None


def parse_price_amount(val) -> float | None:
    """Parse a price value (could be int in cents, float, or string)."""
    if val is None:
        return None
    if isinstance(val, (int, float)):
        # ALDI stores prices in cents
        if val > 100:
            return round(val / 100, 2)
        return round(float(val), 2)
    if isinstance(val, str):
        val = val.replace(",", ".").replace("€", "").strip()
        try:
            return round(float(val), 2)
        except ValueError:
            return None
    return None


# --- Unit Extraction ---

def extract_unit(selling_size: str | None, name: str) -> str:
    """Extract unit/size from selling_size or product name."""
    if selling_size:
        s = selling_size.strip()
        m = re.match(r"(\d+(?:,\d+)?)\s*kg", s)
        if m:
            kg = float(m.group(1).replace(",", "."))
            return f"{int(kg * 1000)}g"
        m = re.match(r"(\d+(?:,\d+)?)\s*l\b", s)
        if m:
            l_val = float(m.group(1).replace(",", "."))
            if l_val < 1:
                return f"{int(l_val * 1000)}ml"
            return f"{l_val}l"
        m = re.match(r"(\d+(?:,\d+)?)\s*g\b", s)
        if m:
            return s
        m = re.match(r"(\d+(?:,\d+)?)\s*ml\b", s)
        if m:
            return s
        return s

    # Try to extract from name
    m = re.search(r"(\d+(?:,\d+)?)\s*(g|kg|ml|l|cl|stk|stück|st)\b", name, re.IGNORECASE)
    if m:
        return m.group(0).replace("stück", "Stk").replace("Stück", "Stk")
    return ""


# --- Data Extraction: __NUXT_DATA__ (Nuxt 3) ---

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

        name_idx = item["name"]
        price_idx = item["price"]
        selling_size_idx = item.get("sellingSize")
        categories_idx = item.get("categories")
        brand_idx = item.get("brandName")

        name = data[name_idx] if isinstance(name_idx, int) and name_idx >= 0 else None
        if not name or not isinstance(name, str):
            continue

        brand = data[brand_idx] if isinstance(brand_idx, int) and brand_idx >= 0 else None

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

        selling_size = None
        if isinstance(selling_size_idx, int) and selling_size_idx >= 0:
            selling_size = data[selling_size_idx]

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

        full_name = f"{brand} {name}" if brand and brand not in name else name

        products.append({
            "name": full_name,
            "price": round(amount / 100, 2),
            "old_price_display": was_price_display,
            "selling_size": selling_size,
            "aldi_categories": cats,
        })

    return products


# --- Data Extraction: __NEXT_DATA__ (Next.js) ---

def extract_next_data_products(next_data: dict) -> list[dict]:
    """Parse Next.js __NEXT_DATA__ JSON into product objects."""
    products = []

    # Navigate the Next.js data structure
    props = next_data.get("props", {})
    page_props = props.get("pageProps", {})

    # Try common paths for product data
    product_lists = []

    # Direct products array
    if "products" in page_props:
        product_lists.append(page_props["products"])

    # Nested in data
    if "data" in page_props:
        data = page_props["data"]
        if isinstance(data, dict):
            for key in ("products", "items", "offers", "articles"):
                if key in data:
                    product_lists.append(data[key])
        elif isinstance(data, list):
            product_lists.append(data)

    # Search recursively for product-like objects
    def find_products(obj, depth=0):
        if depth > 10:
            return
        if isinstance(obj, dict):
            # Check if this looks like a product
            if any(k in obj for k in ("price", "preis", "salePrice")) and \
               any(k in obj for k in ("name", "title", "productName", "produktname")):
                products.append(obj)
                return
            for v in obj.values():
                find_products(v, depth + 1)
        elif isinstance(obj, list):
            for item in obj:
                find_products(item, depth + 1)

    for pl in product_lists:
        if isinstance(pl, list):
            for item in pl:
                find_products(item)

    if not products:
        find_products(page_props)

    # Normalize products
    result = []
    for p in products:
        name = p.get("name") or p.get("title") or p.get("productName") or p.get("produktname")
        if not name:
            continue

        # Price extraction
        price_val = p.get("price") or p.get("preis") or p.get("salePrice")
        if isinstance(price_val, dict):
            price = parse_price_amount(price_val.get("amount") or price_val.get("value"))
            old_price_display = price_val.get("wasPriceDisplay") or price_val.get("oldPrice")
        else:
            price = parse_price_amount(price_val)
            old_price_display = p.get("oldPrice") or p.get("wasPrice") or p.get("regularPrice")

        if price is None:
            continue

        selling_size = p.get("sellingSize") or p.get("size") or p.get("weight")
        cats = p.get("categories") or p.get("category") or []
        if isinstance(cats, str):
            cats = [cats]

        brand = p.get("brandName") or p.get("brand") or p.get("manufacturer")
        full_name = f"{brand} {name}" if brand and str(brand) not in str(name) else str(name)

        result.append({
            "name": full_name,
            "price": price,
            "old_price_display": old_price_display if isinstance(old_price_display, str) else None,
            "selling_size": selling_size if isinstance(selling_size, str) else None,
            "aldi_categories": cats if isinstance(cats, list) else [],
        })

    return result


# --- HTML Fallback Parser ---

def extract_from_html_fallback(html: str) -> list[dict]:
    """Fallback: extract offers from HTML text when no JSON data found."""
    products = []
    soup = BeautifulSoup(html, "html.parser")

    # Look for product cards / offer elements
    for card in soup.find_all(["div", "article", "li"], class_=re.compile(
            r"product|offer|article|angebot|teaser", re.I)):
        name_el = card.find(["h2", "h3", "h4", "span", "p"],
                            class_=re.compile(r"name|title|product", re.I))
        price_el = card.find(["span", "div", "p"],
                             class_=re.compile(r"price|preis", re.I))

        if not name_el or not price_el:
            continue

        name = name_el.get_text(strip=True)
        price_text = price_el.get_text(strip=True)

        # Parse price
        m = re.search(r"(\d+)[,.](\d{2})\s*€?", price_text)
        if not m:
            continue
        price = float(f"{m.group(1)}.{m.group(2)}")

        # Look for old price
        old_price = None
        old_el = card.find(["span", "div", "p", "s", "del"],
                           class_=re.compile(r"old|was|regular|strike|prev", re.I))
        if old_el:
            old_text = old_el.get_text(strip=True)
            m2 = re.search(r"(\d+)[,.](\d{2})\s*€?", old_text)
            if m2:
                old_price = float(f"{m2.group(1)}.{m2.group(2)}")

        products.append({
            "name": name,
            "price": price,
            "old_price_display": f"{old_price:.2f} €" if old_price else None,
            "selling_size": None,
            "aldi_categories": [],
        })

    return products


# --- Data Extraction Entry Points ---

def extract_nuxt_data(html: str) -> list | None:
    """Extract __NUXT_DATA__ JSON array from HTML."""
    match = re.search(r'id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


def extract_next_data(html: str) -> dict | None:
    """Extract __NEXT_DATA__ JSON from HTML."""
    match = re.search(r'id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


# --- Date Extraction ---

def extract_validity_dates(html: str) -> tuple[str, str]:
    """Extract the offer validity date range from page content."""
    # Try: "Mo., 13.4. – Sa., 18.4." or "Mo., 13.04. – Sa., 18.04."
    date_pattern = r"(\d{1,2})\.(\d{1,2})\.\s*[–\-]\s*(?:Sa\.?,?\s*)?(\d{1,2})\.(\d{1,2})\."
    m = re.search(date_pattern, html)
    if m:
        d1, m1, d2, m2 = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4))
        year = datetime.now().year
        return f"{year}-{m1:02d}-{d1:02d}", f"{year}-{m2:02d}-{d2:02d}"

    # Try: "Ab Montag, 13. April" / "Ab Montag, 20. April"
    german_months = {
        "januar": 1, "februar": 2, "märz": 3, "maerz": 3, "april": 4,
        "mai": 5, "juni": 6, "juli": 7, "august": 8, "september": 9,
        "oktober": 10, "november": 11, "dezember": 12,
    }
    m2 = re.search(r"Ab\s+Montag,?\s+(\d{1,2})\.\s+(\w+)", html)
    if m2:
        day = int(m2.group(1))
        month_name = m2.group(2).lower()
        month = german_months.get(month_name)
        if month:
            year = datetime.now().year
            valid_from = f"{year}-{month:02d}-{day:02d}"
            from_dt = datetime.strptime(valid_from, "%Y-%m-%d")
            valid_until = (from_dt + timedelta(days=5)).strftime("%Y-%m-%d")
            return valid_from, valid_until

    # Fallback: compute Monday-Saturday of current week
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    saturday = monday + timedelta(days=5)
    return monday.strftime("%Y-%m-%d"), saturday.strftime("%Y-%m-%d")


# --- URL Generation ---

def get_urls_to_try() -> list[str]:
    """Generate list of URLs to try, ordered by likelihood."""
    today = datetime.now()
    monday = today - timedelta(days=today.weekday())
    year = today.year

    # German month names for slug-based URLs
    german_months_lower = [
        "", "januar", "februar", "maerz", "april", "mai", "juni",
        "juli", "august", "september", "oktober", "november", "dezember",
    ]

    # Also try next Monday in case we're on a weekend
    next_monday = monday + timedelta(days=7)

    urls = [
        # Main offers page (always try first)
        "https://www.aldi-sued.de/de/angebote.html",

        # Date-based URL with current Monday
        f"https://www.aldi-sued.de/de/angebote/d.{monday.strftime('%d-%m-%Y')}.html",

        # Date-based with dashes
        f"https://www.aldi-sued.de/angebote/{monday.strftime('%Y-%m-%d')}",

        # Slug-based with German month name
        f"https://www.aldi-sued.de/de/angebote/angebote-ab-montag-{monday.day}-{german_months_lower[monday.month]}/",

        # Try next Monday too
        f"https://www.aldi-sued.de/de/angebote/d.{next_monday.strftime('%d-%m-%Y')}.html",
        f"https://www.aldi-sued.de/angebote/{next_monday.strftime('%Y-%m-%d')}",
    ]

    return urls


# --- Main Scraping Logic ---

def fetch_page(session: requests.Session, url: str) -> str | None:
    """Fetch a page and return HTML text, or None on failure."""
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  Failed: {e}")
        return None


def scrape() -> dict | None:
    """Main scraping function. Returns the offers dict or None on failure."""

    today = datetime.now()
    urls_to_try = get_urls_to_try()

    session = make_session()

    # Warm up session
    print("Warming up session...")
    try:
        session.get("https://www.aldi-sued.de/", timeout=30)
    except Exception as e:
        print(f"  Warning: Main page visit failed: {e}")

    # Try each URL
    html = None
    source_url = None
    data_format = None

    for url in urls_to_try:
        print(f"Trying: {url}")
        html = fetch_page(session, url)
        if not html:
            continue

        # Check for __NUXT_DATA__
        nuxt = extract_nuxt_data(html)
        if nuxt:
            source_url = url
            data_format = "nuxt"
            print(f"  ✓ Found __NUXT_DATA__ ({len(html)} bytes)")
            break

        # Check for __NEXT_DATA__
        nextjs = extract_next_data(html)
        if nextjs:
            source_url = url
            data_format = "nextjs"
            print(f"  ✓ Found __NEXT_DATA__ ({len(html)} bytes)")
            break

        # Check if page has meaningful content at all
        if "angebot" in html.lower() and len(html) > 50000:
            print(f"  No JSON data, but page has content ({len(html)} bytes) - will try HTML fallback")
            source_url = url
            data_format = "html_fallback"
            break

        print(f"  No usable data found")

    if not html or not source_url:
        print("ERROR: Could not fetch any ALDI SÜD offers page")
        return None

    # Extract products based on format
    raw_products = []

    if data_format == "nuxt":
        nuxt_data = extract_nuxt_data(html)
        if nuxt_data:
            raw_products = resolve_nuxt_data(nuxt_data)
            print(f"  Parsed {len(raw_products)} products from __NUXT_DATA__")

    elif data_format == "nextjs":
        next_data = extract_next_data(html)
        if next_data:
            raw_products = extract_next_data_products(next_data)
            print(f"  Parsed {len(raw_products)} products from __NEXT_DATA__")

    elif data_format == "html_fallback":
        raw_products = extract_from_html_fallback(html)
        print(f"  Parsed {len(raw_products)} products from HTML fallback")

    if not raw_products:
        print("  No products extracted!")
        return None

    # Extract validity dates
    valid_from, valid_until = extract_validity_dates(html)
    print(f"  Valid: {valid_from} to {valid_until}")

    # Filter to food items and build offers
    offers = []
    for p in raw_products:
        category = classify_category(p["name"], p["aldi_categories"])
        if not category:
            continue  # Skip non-food

        old_price = parse_was_price(p["old_price_display"])
        unit = extract_unit(p["selling_size"], p["name"])

        offers.append({
            "name": p["name"],
            "price": p["price"],
            "old_price": old_price,
            "unit": unit,
            "category": category,
        })

    print(f"  → {len(offers)} food offers (from {len(raw_products)} total)")

    return {
        "store": "ALDI SÜD",
        "date": today.strftime("%Y-%m-%d"),
        "valid_from": valid_from,
        "valid_until": valid_until,
        "source": "aldi-sued.de",
        "offers": offers,
    }


# --- Main ---

def main():
    print(f"ALDI SÜD Scraper — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 55)

    # Load existing data as fallback
    existing = None
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE) as f:
                existing = json.load(f)
            print(f"Existing file: {len(existing.get('offers', []))} offers from {existing.get('date', '?')}")
        except Exception as e:
            print(f"Warning: Could not load existing: {e}")

    # Scrape
    result = scrape()

    if result and result.get("offers"):
        with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Saved {len(result['offers'])} offers to {OUTPUT_FILE}")
        print(f"  Valid: {result['valid_from']} to {result['valid_until']}")

        # Category summary
        cats = {}
        for o in result["offers"]:
            cats[o["category"]] = cats.get(o["category"], 0) + 1
        print("  Categories:")
        for c, n in sorted(cats.items()):
            print(f"    {c}: {n}")

        # Sale highlights
        on_sale = [o for o in result["offers"] if o.get("old_price")]
        if on_sale:
            print(f"\n  🔥 {len(on_sale)} items on sale:")
            for o in on_sale[:10]:
                saving = o["old_price"] - o["price"]
                print(f"    {o['name']}: {o['price']}€ (was {o['old_price']}€, save {saving:.2f}€)")

        return 0
    else:
        print("\n⚠ Scraping returned no offers!")
        if existing:
            print(f"  Keeping existing data ({len(existing.get('offers', []))} offers)")
        else:
            print("  No existing data to fall back to!")
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
        return 1


if __name__ == "__main__":
    sys.exit(main())
