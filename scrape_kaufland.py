#!/usr/bin/env python3
"""Kaufland Offer Scraper."""
import requests, re, json, sys
from datetime import datetime, timedelta
from pathlib import Path

BASE = Path(__file__).parent
OUTPUT = BASE / "offers" / "kaufland.json"
HEADERS = {"User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36", "Accept-Language": "de-DE,de;q=0.9"}

FOOD_KW = ["hähnchen","huhn","schwein","rind","pute","hack","wurst","bratwurst","schnitzel","nuggets","steak","filet","braten","gulasch","schinken","speck","salami","lachs","fisch","garnelen","thunfisch","dorade","joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan","apfel","orange","banane","erdbeer","mango","birne","kiwi","zitrone","avocado","paprika","kartoffel","zwiebel","karotte","möhre","gurke","tomate","zucchini","spinat","brokkoli","blumenkohl","spargel","salat","champignon","reis","nudeln","mehl","brot","toast","müsli","spaghetti","gnocchi","couscous","tortellini","öl","essig","soße","ketchup","senf","mayo","kokosmilch","brühe","honig","kaffee","tee","schokolade","nuss"]
EXCLUDE_KW = ["sekt","wein","bier","vodka","waschmittel","reiniger","shampoo","spielzeug","blume","pflanze","werkzeug","socken","jacke","hose","kissen","decke","lampe"]

def is_food(n):
    nl = n.lower()
    for ex in EXCLUDE_KW:
        if ex in nl: return False
    for fo in FOOD_KW:
        if fo in nl: return True
    return False

def categorize(n):
    nl = n.lower()
    if any(k in nl for k in ["hähnchen","huhn","schwein","rind","pute","hack","wurst","schnitzel","nuggets","steak","braten","gulasch","schinken","speck","salami"]): return "fleisch"
    if any(k in nl for k in ["lachs","fisch","garnelen","thunfisch","dorade"]): return "fisch"
    if any(k in nl for k in ["joghurt","butter","milch","käse","sahne","quark","eier","feta","mozzarella","parmesan"]): return "milchprodukte"
    if any(k in nl for k in ["reis","nudeln","mehl","brot","toast","müsli","spaghetti","gnocchi","couscous","tortellini"]): return "trockenwaren"
    if any(k in nl for k in ["apfel","orange","banane","erdbeer","mango","birne","kiwi","zitrone","avocado"]): return "obst"
    if any(k in nl for k in ["paprika","kartoffel","zwiebel","karotte","möhre","gurke","tomate","zucchini","spinat","brokkoli","blumenkohl","spargel","salat","champignon"]): return "gemuese"
    return "sonstiges"

def scrape():
    print(f"🔍 Kaufland — {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    url = "https://www.kaufland.de/angebote/aktuelle-woche.html"
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
    except Exception as e:
        print(f"❌ {e}"); return False
    if r.status_code != 200:
        print(f"❌ HTTP {r.status_code}"); return False
    text = re.sub(r'<script[^>]*>.*?</script>', '', r.text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', r.text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '\n', text)
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    products = []
    for i, line in enumerate(lines):
        pm = re.search(r'(\d+[,.]\d{2})\s*€', line)
        if not pm: continue
        if re.search(r'\(.*€.*\)', line): continue
        price = float(pm.group(1).replace(",", "."))
        if price < 0.10 or price > 50: continue
        name = ""
        for j in range(i-1, max(i-4, 0), -1):
            c = lines[j].strip()
            if len(c) > 3 and not re.search(r'€', c) and not re.match(r'^\d', c):
                name = c; break
        if name and is_food(name):
            products.append({"name": name, "price": price, "old_price": None, "unit": "", "category": categorize(name)})
    seen = set(); unique = []
    for p in products:
        k = p["name"].lower()
        if k not in seen: seen.add(k); unique.append(p)
    OUTPUT.parent.mkdir(exist_ok=True)
    today = datetime.now(); mon = today - timedelta(days=today.weekday())
    with open(OUTPUT, "w") as f:
        json.dump({"store": "Kaufland", "date": today.strftime("%Y-%m-%d"), "valid_from": mon.strftime("%Y-%m-%d"), "valid_until": (mon+timedelta(days=5)).strftime("%Y-%m-%d"), "offers": unique}, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(unique)} → {OUTPUT.name}")
    return True

if __name__ == "__main__": sys.exit(0 if scrape() else 1)
