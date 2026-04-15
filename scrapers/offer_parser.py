#!/usr/bin/env python3
"""
Offer Parser — Parses clean text from web_extract output.
Run this after web_extract has saved the data.
Manual fallback: edit data/offers/*.json directly.
"""

import re, json
from pathlib import Path
from datetime import datetime

BASE = Path(__file__).parent.parent
OFFERS_DIR = BASE / "data" / "offers"
OFFERS_DIR.mkdir(parents=True, exist_ok=True)

FOOD_KW = {
    "hähnchen","huhn","schwein","rind","hackfleisch","lachs","thunfisch","fisch",
    "garnelen","bratwurst","schnitzel","puten","nacken","gulasch","wurst","speck",
    "schinken","nuggets","frikadellen","bockwurst","kebab","rindfleisch","mortadella",
    "milch","butter","käse","joghurt","sahne","quark","eier","feta","mozzarella",
    "parmesan","schmand","ricotta","camembert","butterkäse","räucherkäse","obatzda",
    "nudeln","pasta","spaghetti","penne","reis","mehl","brot","brötchen","ciabatta",
    "gnocchi","tortellini","couscous","linguine","müsli","flocken",
    "tomaten","paprika","zwiebeln","kartoffel","möhren","karotten","gurke",
    "zucchini","spinat","brokkoli","blumenkohl","salat","avocado","zitrone",
    "kürbis","bohnen","linsen","kichererbsen","erbsen","mais","champignons",
    "spargel","kohlrabi","chicoree","brechbohnen",
    "apfel","banane","erdbeer","orange","mango","birne","kiwi","himbeer",
    "olivenöl","sojasauce","kokosmilch","pesto","brühe","essig","senf",
    "ketchup","honig","marmelade","kräuter","spinaci",
    "joghurt","schokolade","eis","magnum","bienenstich",
}

CAT_MAP = {
    "fleisch": ["hähnchen","huhn","schwein","rind","hackfleisch","bratwurst","schnitzel","puten","nacken","gulasch","wurst","speck","schinken","nuggets","frikadellen","bockwurst","kebab","rindfleisch","mortadella","leberwurst"],
    "fisch": ["lachs","thunfisch","fisch","garnelen","stremellachs","räucherlachs","forelle"],
    "milchprodukte": ["milch","butter","käse","joghurt","sahne","quark","eier","feta","mozzarella","parmesan","camembert","butterkäse","räucherkäse","obatzda"],
    "trockenwaren": ["nudeln","pasta","spaghetti","penne","reis","mehl","brot","brötchen","ciabatta","gnocchi","tortellini","couscous","linguine","müsli","flocken","spinaci"],
    "gemuese": ["tomaten","paprika","zwiebeln","kartoffel","möhren","karotten","gurke","zucchini","spinat","brokkoli","blumenkohl","salat","avocado","zitrone","kürbis","bohnen","linsen","kichererbsen","erbsen","mais","champignons","spargel","kohlrabi","chicoree","brechbohnen","kräuter"],
    "obst": ["apfel","banane","erdbeer","orange","mango","birne","kiwi","himbeer"],
}

def is_food(name):
    return any(kw in name.lower() for kw in FOOD_KW)

def categorize(name):
    n = name.lower()
    for cat, kws in CAT_MAP.items():
        if any(k in n for k in kws):
            return cat
    return "sonstiges"

def parse_marktguru_text(text, store_name):
    """Parse clean text from marktguru web_extract output."""
    offers = []
    lines = text.split("\n")
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Look for price pattern: "€ X,XX" or "-N%\n€ X,XX"
        price_match = re.match(r'^€\s*(\d+[,.]\d{2})$', line)
        if not price_match:
            # Check for discount line before price
            if re.match(r'^-\d+%$', line) and i+1 < len(lines):
                next_price = re.match(r'^€\s*(\d+[,.]\d{2})$', lines[i+1].strip())
                if next_price:
                    price_match = next_price
                    i += 1  # skip discount line
        
        if price_match:
            price = float(price_match.group(1).replace(",", "."))
            
            # Look backwards for product name
            name = ""
            brand = ""
            j = i - 1
            while j >= 0 and j > i - 5:
                prev = lines[j].strip()
                if prev.startswith("Marke:"):
                    brand = prev.replace("Marke:", "").strip()
                elif prev and not prev.startswith("€") and not prev.startswith("-") and not prev.startswith("Preis:") and not prev.startswith("Brandneu") and not prev.startswith("Läuft") and "Gültig:" not in prev and "Händler:" not in prev and len(prev) > 2:
                    name = prev
                    break
                j -= 1
            
            if name and is_food(name):
                # Look forwards for unit info and validity
                unit = ""
                qty = ""
                old_price = None
                discount_pct = None
                valid_from = ""
                valid_until = ""
                
                for k in range(i+1, min(i+8, len(lines))):
                    l = lines[k].strip()
                    
                    # Unit price: "€ X,XX / kg"
                    unit_match = re.search(r'€\s*([\d,.]+)\s*/\s*(\w+)', l)
                    if unit_match:
                        unit = f"{unit_match.group(1)}€/{unit_match.group(2)}"
                    
                    # Quantity: "Je 500 g"
                    qty_match = re.search(r'Je\s+(\d+\s*(?:g|kg|ml|l|Stk))', l, re.IGNORECASE)
                    if qty_match:
                        qty = qty_match.group(1)
                    
                    # Validity: "Gültig: DD.MM. - DD.MM."
                    val_match = re.search(r'Gültig:\s*(\d+\.\d+\.)\s*-\s*(\d+\.\d+\.)', l)
                    if val_match:
                        valid_from = val_match.group(1)
                        valid_until = val_match.group(2)
                    
                    # Store line means end of this offer
                    if l.startswith("Händler:"):
                        break
                
                # Check for old price in previous line
                if j > 0:
                    for prev_line in lines[max(0,j-2):j]:
                        old_match = re.search(r'~~€\s*([\d,.]+)~~', prev_line)
                        if old_match:
                            old_price = float(old_match.group(1).replace(",", "."))
                
                # Check for discount percentage
                for prev_line in lines[max(0,i-3):i+1]:
                    disc_match = re.search(r'-(\d+)%', prev_line)
                    if disc_match:
                        discount_pct = int(disc_match.group(1))
                
                offers.append({
                    "name": name,
                    "brand": brand,
                    "price": price,
                    "old_price": old_price,
                    "discount_pct": discount_pct,
                    "unit": unit,
                    "quantity": qty,
                    "category": categorize(name),
                    "store": store_name,
                    "valid_from": valid_from,
                    "valid_until": valid_until,
                })
        i += 1
    
    return offers

if __name__ == "__main__":
    print("Offer Parser ready. Use parse_marktguru_text(text, store) to parse web_extract output.")
    print("Or manually edit data/offers/*.json files.")
