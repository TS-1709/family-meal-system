#!/usr/bin/env python3
"""
Family Meal Planner — Generates weekly meal plans based on ALDI SÜD deals.
Reads meals.json, matches with current offers, outputs interactive HTML.
"""

import json, sys, re
from pathlib import Path
from datetime import datetime, timedelta

BASE = Path(__file__).parent
MEALS_FILE = BASE / "meals.json"
OFFERS_FILE = BASE / "current_offers.json"
OUTPUT_DIR = BASE / "plans"

def load_meals():
    with open(MEALS_FILE) as f:
        return json.load(f)

def load_offers():
    """Load current offers from file (updated by scraper or manually)."""
    if OFFERS_FILE.exists():
        with open(OFFERS_FILE) as f:
            return json.load(f)
    return {"store": "ALDI SÜD", "date": "unknown", "offers": []}

def match_meals_to_offers(meals, offers):
    """Score meals based on how many ingredients are on offer."""
    offer_products = set()
    for o in offers.get("offers", []):
        name = o.get("name", "").lower()
        offer_products.add(name)
        # Also add individual words for fuzzy matching
        for word in name.split():
            if len(word) > 3:
                offer_products.add(word)
    
    scored = []
    for meal in meals["meals"]:
        score = 0
        matched_ingredients = []
        for ing in meal.get("key_ingredients", []):
            ing_lower = ing.lower().replace("_", " ")
            for op in offer_products:
                if ing_lower in op or op in ing_lower:
                    score += 1
                    matched_ingredients.append(ing)
                    break
        scored.append({**meal, "offer_score": score, "matched_ingredients": matched_ingredients})
    
    return sorted(scored, key=lambda x: -x["offer_score"])

def select_week(meals_scored, n_days=7, meals_per_day=2):
    """Select a week of meals with variety — no protein overload."""
    selected = []
    used_tags = set()
    used_names = set()
    protein_count = {"fleisch": 0, "fisch": 0, "vegan": 0, "vegetarisch": 0}
    max_per_protein = {"fleisch": 3, "fisch": 2, "vegan": 2, "vegetarisch": 4}
    
    categories_needed = {"mittag": 4, "abend": 7, "frühstück": 2}
    
    for meal in meals_scored:
        if meal["name"] in used_names:
            continue
        cat = meal.get("category", "abend")
        if categories_needed.get(cat, 0) <= 0:
            continue
        
        # Check protein variety
        meal_tags = set(meal.get("tags", []))
        dominated = False
        for ptype, max_n in max_per_protein.items():
            if ptype in meal_tags and protein_count.get(ptype, 0) >= max_n:
                dominated = True
                break
        if dominated:
            continue
        
        selected.append(meal)
        used_names.add(meal["name"])
        used_tags.update(meal_tags)
        categories_needed[cat] = categories_needed.get(cat, 0) - 1
        
        # Update protein count
        for ptype in protein_count:
            if ptype in meal_tags:
                protein_count[ptype] += 1
        
        if len(selected) >= n_days * meals_per_day:
            break
    
    return selected

def generate_html(meals_selected, data, offers):
    """Generate interactive HTML with checkboxes."""
    now = datetime.now()
    kw = now.isocalendar()[1]
    week_start = now - timedelta(days=now.weekday())
    week_end = week_start + timedelta(days=6)
    
    # Build shopping list from selected meals
    shopping = {}
    for meal in meals_selected:
        for ing in meal.get("key_ingredients", []):
            ing_name = ing.replace("_", " ").title()
            if ing_name not in shopping:
                shopping[ing_name] = 0
            shopping[ing_name] += 1
    
    # Group ingredients by category
    categories = {
        "🥩 Fleisch & Fisch": [],
        "🧀 Milchprodukte": [],
        "🍝 Nudeln & Reis": [],
        "🥬 Obst & Gemüse": [],
        "📦 Sonstiges": [],
    }
    
    meat_kw = ["hähnchen","lachs","hackfleisch","puten","schweine","thunfisch","wiener","speck","schinken","fisch","rindfisch","dorade","cevapcici"]
    dairy_kw = ["käse","sahne","milch","joghurt","butter","eier","parmesan","mozzarella","feta","halloumi","quark","ricotta","gorgonzola","spätzle"]
    carb_kw = ["nudeln","reis","mehl","brot","toast","gnocchi","spaghetti","penne","tortilla","taco","blätterteig","maultaschen","tortellini","pinsa","burgerbrötchen","pita","baguette","fladenbrot","lasagneplatten"]
    veg_kw = ["tomaten","paprika","zwiebeln","möhren","kartoffeln","gurke","zucchini","spinat","brokkoli","blumenkohl","avocado","salat","kürbis","bananen","äpfel","himbeeren","pak_choi","rote_bete"]
    
    for ing, count in shopping.items():
        ing_l = ing.lower()
        found = False
        for kw_list, cat in [(meat_kw, "🥩 Fleisch & Fisch"), (dairy_kw, "🧀 Milchprodukte"), (carb_kw, "🍝 Nudeln & Reis"), (veg_kw, "🥬 Obst & Gemüse")]:
            if any(k in ing_l for k in kw_list):
                categories[cat].append((ing, count))
                found = True
                break
        if not found:
            categories["📦 Sonstiges"].append((ing, count))
    
    # Build days
    days = ["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"]
    
    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Essensplan KW {kw}</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ font-family:-apple-system,sans-serif; background:#f8f8f8; color:#333; padding:16px; max-width:480px; margin:0 auto; }}
.hdr {{ background:#1a5c2e; color:#fff; padding:20px; border-radius:14px; text-align:center; margin-bottom:16px; }}
.hdr h1 {{ font-size:20px; }}
.hdr .sub {{ font-size:12px; opacity:.8; margin-top:4px; }}
.day {{ background:#fff; border-radius:12px; padding:14px; margin-bottom:10px; box-shadow:0 1px 4px rgba(0,0,0,.06); }}
.day h3 {{ color:#1a5c2e; font-size:14px; margin-bottom:8px; border-bottom:2px solid #e8f5e9; padding-bottom:4px; }}
.meal {{ font-size:13px; margin-bottom:4px; }}
.ml {{ color:#888; font-size:11px; display:inline-block; width:55px; }}
.tag {{ font-size:10px; padding:1px 6px; border-radius:8px; margin-left:4px; }}
.tv {{ background:#e8f5e9; color:#2d7a3a; }}
.tf {{ background:#e3f2fd; color:#1565c0; }}
.tm {{ background:#fff3e0; color:#e65100; }}
.section {{ background:#fff; border-radius:12px; padding:14px; margin-top:16px; box-shadow:0 1px 4px rgba(0,0,0,.06); }}
.section h2 {{ color:#1a5c2e; font-size:15px; margin-bottom:10px; }}
.cat {{ font-size:12px; font-weight:600; color:#555; margin-top:10px; margin-bottom:4px; }}
.chk {{ display:flex; align-items:center; padding:6px 0; border-bottom:1px solid #f5f5f5; font-size:13px; cursor:pointer; }}
.chk input {{ margin-right:8px; accent-color:#1a5c2e; width:18px; height:18px; }}
.chk label {{ flex:1; }}
.chk input:checked + label {{ text-decoration:line-through; color:#aaa; }}
.done {{ background:#e8f5e9; border-radius:10px; padding:10px; text-align:center; margin-top:12px; font-size:12px; color:#1a5c2e; }}
.ftr {{ text-align:center; color:#bbb; font-size:10px; margin-top:16px; }}
</style>
</head>
<body>
<div class="hdr">
<h1>Essensplan KW {kw}</h1>
<div class="sub">{week_start.strftime('%d.%m.')} – {week_end.strftime('%d.%m.%Y')} · ALDI SÜD · 92729</div>
</div>
"""
    
    # Days with meals
    meal_idx = 0
    for day_name in days:
        html += f'<div class="day"><h3>{day_name}</h3>\n'
        for slot in ["mittag", "abend"]:
            matching = [m for m in meals_selected if m.get("category") == slot and m not in [x for x in meals_selected[:meal_idx]]]
            if matching:
                meal = matching[0]
                meals_selected.remove(meal)
                tag_html = ""
                for t in meal.get("tags", [])[:2]:
                    if t in ["vegetarisch","vegan"]: tag_html += '<span class="tag tv">🌱</span>'
                    elif t == "fisch": tag_html += '<span class="tag tf">🐟</span>'
                    elif t == "fleisch": tag_html += '<span class="tag tm">🍗</span>'
                    elif t == "kind": tag_html += '<span class="tag tv">👶</span>'
                html += f'<div class="meal"><span class="ml">{slot.title()}</span>{meal["name"]} {tag_html}</div>\n'
        html += '</div>\n'
    
    # Shopping list with checkboxes
    html += '<div class="section"><h2>🛒 Einkaufsliste</h2>\n'
    
    item_num = 0
    for cat_name, items in categories.items():
        if items:
            html += f'<div class="cat">{cat_name}</div>\n'
            for ing, count in sorted(items):
                qty = f" (x{count})" if count > 1 else ""
                html += f'''<div class="chk">
<input type="checkbox" id="i{item_num}" onchange="updateCount()">
<label for="i{item_num}">{ing}{qty}</label>
</div>\n'''
                item_num += 1
    
    html += f"""<div class="done" id="status">0 / {item_num} eingekauft</div>
</div>

<div class="ftr">
Generiert von Hermes · KW {kw} · ALDI SÜD 92729
</div>

<script>
function updateCount() {{
  const all = document.querySelectorAll('.chk input');
  const checked = document.querySelectorAll('.chk input:checked');
  document.getElementById('status').textContent = checked.length + ' / ' + all.length + ' eingekauft';
  // Save state
  const state = {{}};
  all.forEach(cb => state[cb.id] = cb.checked);
  localStorage.setItem('shopping_' + '{kw}', JSON.stringify(state));
}}
// Restore state
try {{
  const saved = JSON.parse(localStorage.getItem('shopping_' + '{kw}') || '{{}}');
  Object.entries(saved).forEach(([id, checked]) => {{
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  }});
  updateCount();
}} catch(e) {{}}
</script>
</body>
</html>"""
    
    return html


if __name__ == "__main__":
    data = load_meals()
    offers = load_offers()
    
    print(f"Geladen: {len(data['meals'])} Gerichte")
    print(f"Angebote: {len(offers.get('offers', []))} aktuelle Angebote")
    
    scored = match_meals_to_offers(data, offers)
    print(f"\nTop 5 nach Angebot-Match:")
    for m in scored[:5]:
        print(f"  {m['offer_score']}★ {m['name']} → {m.get('matched_ingredients', [])}")
    
    selected = select_week(scored)
    print(f"\nAusgewählt: {len(selected)} Gerichte")
    for m in selected:
        print(f"  [{m['category']}] {m['name']}")
    
    OUTPUT_DIR.mkdir(exist_ok=True)
    html = generate_html(selected, data, offers)
    
    kw = datetime.now().isocalendar()[1]
    outpath = OUTPUT_DIR / f"plan_kw{kw}.html"
    with open(outpath, "w") as f:
        f.write(html)
    
    print(f"\nGespeichert: {outpath}")
