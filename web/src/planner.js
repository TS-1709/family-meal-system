/**
 * Plan Generation Logic - ported from Python generate.py
 * Scores meals by offer matches, selects weekly meals with variety rules.
 */

// Simple seeded pseudo-random number generator (mulberry32)
function seededRandom(seed) {
  let s = seed | 0;
  return function() {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getWeekNumber(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export function getWeekDates(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const days = [];
  const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    days.push({
      name: dayNames[i],
      date: date,
      dateStr: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.`
    });
  }
  return days;
}

/**
 * Match meals to offers and score them
 */
export function matchMealsToOffers(mealsData, offersData) {
  const offerProducts = new Set();
  for (const o of offersData.offers || []) {
    const name = (o.name || '').toLowerCase();
    offerProducts.add(name);
    for (const word of name.split(/\s+/)) {
      if (word.length > 3) {
        offerProducts.add(word);
      }
    }
  }

  return mealsData.meals.map(meal => {
    let score = 0;
    const matchedIngredients = [];
    for (const ing of meal.key_ingredients || []) {
      const ingLower = ing.toLowerCase().replace(/_/g, ' ');
      for (const op of offerProducts) {
        if (ingLower.includes(op) || op.includes(ingLower)) {
          score += 1;
          matchedIngredients.push(ing);
          break;
        }
      }
    }
    return { ...meal, offerScore: score, matchedIngredients };
  });
}

/**
 * Shuffle array deterministically with a seed
 */
function shuffleArray(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select a week of meals with variety rules
 */
export function selectWeek(mealsScored, weekNumber, nDays = 7, mealsPerDay = 2) {
  const rng = seededRandom(weekNumber * 7919);

  // Sort by offer score first, then shuffle for variety
  const sorted = [...mealsScored].sort((a, b) => {
    const scoreDiff = (b.offerScore || 0) - (a.offerScore || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return rng() - 0.5;
  });

  const selected = [];
  const usedNames = new Set();
  const proteinCount = { fleisch: 0, fisch: 0, vegan: 0, vegetarisch: 0 };
  const maxPerProtein = { fleisch: 3, fisch: 2, vegan: 2, vegetarisch: 4 };
  let suppenCount = 0;
  const maxSuppen = 2;
  const totalNeeded = nDays * mealsPerDay;

  // We need mittag and abend meals
  const mittagNeeded = 7;
  const abendNeeded = 7;
  let mittagSelected = 0;
  let abendSelected = 0;

  // First pass: prioritize offer-matched meals with variety
  for (const meal of sorted) {
    if (selected.length >= totalNeeded) break;
    if (usedNames.has(meal.name)) continue;

    const cat = meal.category || 'abend';
    if (cat === 'mittag' && mittagSelected >= mittagNeeded) continue;
    if (cat === 'abend' && abendSelected >= abendNeeded) continue;
    if (cat === 'frühstück') continue;

    const mealTags = new Set(meal.tags || []);

    // Check protein variety
    let dominated = false;
    for (const [ptype, maxN] of Object.entries(maxPerProtein)) {
      if (mealTags.has(ptype) && proteinCount[ptype] >= maxN) {
        dominated = true;
        break;
      }
    }
    if (dominated) continue;

    // Check suppe limit
    if (mealTags.has('suppe') && suppenCount >= maxSuppen) continue;

    selected.push(meal);
    usedNames.add(meal.name);

    if (cat === 'mittag') mittagSelected++;
    if (cat === 'abend') abendSelected++;
    if (mealTags.has('suppe')) suppenCount++;

    for (const ptype of Object.keys(proteinCount)) {
      if (mealTags.has(ptype)) proteinCount[ptype]++;
    }
  }

  // If not enough, fill remaining with any available meals
  if (selected.length < totalNeeded) {
    const remaining = shuffleArray(
      mealsScored.filter(m => !usedNames.has(m.name) && m.category !== 'frühstück'),
      rng
    );
    for (const meal of remaining) {
      if (selected.length >= totalNeeded) break;
      const cat = meal.category || 'abend';
      if (cat === 'mittag' && mittagSelected >= mittagNeeded) continue;
      if (cat === 'abend' && abendSelected >= abendNeeded) continue;

      selected.push(meal);
      usedNames.add(meal.name);
      if (cat === 'mittag') mittagSelected++;
      if (cat === 'abend') abendSelected++;
    }
  }

  return selected;
}

/**
 * Distribute selected meals across 7 days
 * Ensures no same protein type for both meals on the same day
 */
export function distributeMealsToDays(selectedMeals) {
  const mittagMeals = selectedMeals.filter(m => m.category === 'mittag');
  const abendMeals = selectedMeals.filter(m => m.category === 'abend');

  // If we don't have enough of one category, split remaining
  const allMeals = [...mittagMeals, ...abendMeals];

  const days = [];
  for (let i = 0; i < 7; i++) {
    const mittag = mittagMeals[i] || null;
    let abend = abendMeals[i] || null;

    // Ensure no same protein type on same day
    if (mittag && abend) {
      const mittagTags = new Set(mittag.tags || []);
      const abendTags = new Set(abend.tags || []);
      const proteinTags = ['fleisch', 'fisch', 'vegan', 'vegetarisch'];
      const conflict = proteinTags.some(t => mittagTags.has(t) && abendTags.has(t));

      if (conflict) {
        // Try to swap abend with another day
        for (let j = i + 1; j < abendMeals.length; j++) {
          const candidateTags = new Set(abendMeals[j].tags || []);
          const stillConflict = proteinTags.some(t => mittagTags.has(t) && candidateTags.has(t));
          if (!stillConflict) {
            [abendMeals[i], abendMeals[j]] = [abendMeals[j], abendMeals[i]];
            abend = abendMeals[i];
            break;
          }
        }
      }
    }

    days.push({ mittag, abend });
  }

  return days;
}

/**
 * Get protein type emoji for a meal
 */
export function getProteinEmoji(meal) {
  if (!meal) return '';
  const tags = meal.tags || [];
  if (tags.includes('fleisch')) return '🍗';
  if (tags.includes('fisch')) return '🐟';
  if (tags.includes('vegan')) return '🌱';
  if (tags.includes('vegetarisch')) return '🥬';
  return '';
}

/**
 * Check if meal has ingredients on sale
 */
export function hasOfferMatch(meal) {
  return meal && meal.matchedIngredients && meal.matchedIngredients.length > 0;
}

/**
 * Build shopping list from selected meals
 */
export function buildShoppingList(meals) {
  const ingredientMap = {};

  for (const meal of meals) {
    if (!meal) continue;
    for (const ing of meal.key_ingredients || []) {
      const name = ing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      ingredientMap[name] = (ingredientMap[name] || 0) + 1;
    }
  }

  // Categorize ingredients
  const categories = {
    'Fleisch & Fisch': [],
    'Milchprodukte': [],
    'Nudeln & Reis': [],
    'Obst & Gemüse': [],
    'Sonstiges': [],
  };

  const meatKw = ['hähnchen', 'lachs', 'hackfleisch', 'puten', 'schwein', 'thunfisch', 'wiener', 'speck', 'schinken', 'fisch', 'rindfisch', 'dorade', 'cevapcici', 'bratwurst', 'salami', 'aufschnitt', 'leberwurst', 'fleisch'];
  const dairyKw = ['käse', 'sahne', 'milch', 'joghurt', 'butter', 'eier', 'parmesan', 'mozzarella', 'feta', 'halloumi', 'quark', 'ricotta', 'gorgonzola', 'spätzle', 'schmand', 'camembert', 'burrata'];
  const carbKw = ['nudeln', 'reis', 'mehl', 'brot', 'toast', 'gnocchi', 'spaghetti', 'penne', 'tortilla', 'taco', 'blätterteig', 'maultaschen', 'tortellini', 'pinsa', 'burgerbrötchen', 'pita', 'baguette', 'fladenbrot', 'lasagne', 'couscous', 'haferflocken', 'hirse', 'müsli'];
  const vegKw = ['tomate', 'paprika', 'zwiebel', 'möhre', 'kartoffel', 'gurke', 'zucchini', 'spinat', 'brokkoli', 'blumenkohl', 'avocado', 'salat', 'kürbis', 'banane', 'apfel', 'himbeere', 'pak choi', 'rote bete', 'erbsen', 'bohnen', 'kichererbsen', 'linsen', 'knoblauch', 'gemüse', 'pilze'];

  for (const [ing, count] of Object.entries(ingredientMap)) {
    const ingL = ing.toLowerCase();
    let placed = false;

    for (const [kwList, cat] of [
      [meatKw, 'Fleisch & Fisch'],
      [dairyKw, 'Milchprodukte'],
      [carbKw, 'Nudeln & Reis'],
      [vegKw, 'Obst & Gemüse'],
    ]) {
      if (kwList.some(k => ingL.includes(k))) {
        categories[cat].push({ name: ing, count, checked: false });
        placed = true;
        break;
      }
    }
    if (!placed) {
      categories['Sonstiges'].push({ name: ing, count, checked: false });
    }
  }

  // Sort each category
  for (const cat of Object.keys(categories)) {
    categories[cat].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }

  return categories;
}

/**
 * Find relevant offers (matching meal ingredients)
 */
export function findRelevantOffers(offersData, meals) {
  const allIngredients = new Set();
  for (const meal of meals) {
    if (!meal) continue;
    for (const ing of meal.key_ingredients || []) {
      allIngredients.add(ing.toLowerCase().replace(/_/g, ' '));
    }
  }

  return (offersData.offers || []).filter(offer => {
    const offerName = offer.name.toLowerCase();
    for (const ing of allIngredients) {
      if (offerName.includes(ing) || ing.includes(offerName.split(' ').pop())) {
        return true;
      }
    }
    return false;
  });
}
