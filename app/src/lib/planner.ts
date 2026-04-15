import { Meal, Offer, MealWithScore, MatchedOffer, DayPlan } from './types';

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Get ISO week number
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// Get Monday of the current week
export function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

// Protein type from tags
function getProteinType(meal: Meal): string {
  if (meal.tags.includes('fleisch')) return 'fleisch';
  if (meal.tags.includes('fisch')) return 'fisch';
  if (meal.tags.includes('vegan')) return 'vegan';
  return 'vegetarisch'; // default
}

function isSuppe(meal: Meal): boolean {
  return meal.tags.includes('suppe') || meal.tags.includes('eintopf');
}

// Fuzzy match: check if ingredient keyword appears in offer name (case-insensitive)
function ingredientMatchesOffer(ingredient: string, offer: Offer): boolean {
  const ing = ingredient.toLowerCase().replace(/_/g, ' ');
  const offerName = offer.name.toLowerCase();

  // Split ingredient on _ and check each part
  const parts = ing.split(/[\/_\s]+/).filter(p => p.length > 2);
  return parts.some(part => {
    // Common ingredient-to-offer mappings
    const mappings: Record<string, string[]> = {
      'hähnchen': ['hähnchen', 'huhn', 'chicken'],
      'hähnchenbrust': ['hähnchen', 'huhn', 'chicken'],
      'hähnchenschnitzel': ['hähnchen', 'chicken', 'nuggets'],
      'lachs': ['lachs', 'salmon'],
      'rinderhack': ['hackfleisch', 'rind'],
      'hackfleisch': ['hackfleisch', 'hack'],
      'paprika': ['paprika'],
      'zwiebeln': ['zwiebel'],
      'kartoffeln': ['kartoffel'],
      'möhren': ['karotten', 'möhren', 'karotte'],
      'tomaten': ['tomaten', 'tomate'],
      'reis': ['reis', 'rice'],
      'sahne': ['sahne', 'sahne'],
      'gurke': ['gurke'],
      'käse': ['käse', 'cheese'],
      'bratwurst': ['bratwurst'],
      'wiener': ['wiener'],
    };

    const searchTerms = mappings[part] || [part];
    return searchTerms.some(term => offerName.includes(term));
  });
}

function scoreMeal(meal: Meal, offers: Offer[]): { score: number; matches: MatchedOffer[] } {
  let score = 0;
  const matches: MatchedOffer[] = [];

  for (const ingredient of meal.key_ingredients) {
    for (const offer of offers) {
      if (ingredientMatchesOffer(ingredient, offer)) {
        score += offer.old_price ? 2 : 1; // Higher score for discounted items
        matches.push({
          ingredient,
          offerName: offer.name,
          price: offer.price,
          oldPrice: offer.old_price,
        });
        break; // One match per ingredient
      }
    }
  }
  return { score, matches };
}

export function generateWeeklyPlan(meals: Meal[], offers: Offer[], weekNumber: number): DayPlan[] {
  const rand = mulberry32(weekNumber * 137);

  // Score all meals
  const scoredMeals: MealWithScore[] = meals.map(meal => {
    const { score, matches } = scoreMeal(meal, offers);
    return {
      ...meal,
      offerScore: score,
      matchedOffers: matches,
    };
  });

  // Sort by offer score desc, then random
  scoredMeals.sort((a, b) => {
    if (b.offerScore !== a.offerScore) return b.offerScore - a.offerScore;
    return rand() - 0.5;
  });

  // Separate mittag and abend eligible meals
  const mittagPool = scoredMeals.filter(m => m.category === 'mittag' || m.category === 'frühstück');
  const abendPool = scoredMeals.filter(m => m.category === 'abend' || m.category === 'frühstück');

  // If not enough, use all meals for both pools
  const allMeals = [...scoredMeals];
  if (mittagPool.length < 7) {
    for (const m of allMeals) {
      if (!mittagPool.includes(m) && mittagPool.length < 14) mittagPool.push(m);
    }
  }
  if (abendPool.length < 7) {
    for (const m of allMeals) {
      if (!abendPool.includes(m) && abendPool.length < 14) abendPool.push(m);
    }
  }

  // Selection with variety rules
  const usedMittag: MealWithScore[] = [];
  const usedAbend: MealWithScore[] = [];
  const meatCount = { fleisch: 0, fisch: 0, vegan: 0, suppe: 0 };

  function canSelect(meal: MealWithScore, isMittag: boolean): boolean {
    const protein = getProteinType(meal);
    const suppe = isSuppe(meal);

    if (protein === 'fleisch' && meatCount.fleisch >= 3) return false;
    if (protein === 'fisch' && meatCount.fisch >= 2) return false;
    if (protein === 'vegan' && meatCount.vegan >= 2) return false;
    if (suppe && meatCount.suppe >= 2) return false;

    // No consecutive suppe
    const prevSlot = isMittag ? null : usedMittag[usedMittag.length - 1];
    if (suppe && prevSlot && isSuppe(prevSlot)) return false;

    // No same protein type for both meals on same day (check other slot)
    if (!isMittag && usedMittag.length > usedAbend.length) {
      const dayMittag = usedMittag[usedAbend.length];
      if (dayMittag && getProteinType(dayMittag) === protein && (protein === 'fleisch' || protein === 'fisch')) {
        return false;
      }
    }

    return true;
  }

  function selectMeals(pool: MealWithScore[], used: MealWithScore[], isMittag: boolean): MealWithScore[] {
    const selected: MealWithScore[] = [];
    const available = [...pool];

    for (let i = 0; i < 7; i++) {
      let found = false;
      for (let j = 0; j < available.length; j++) {
        const meal = available[j];
        if (canSelect(meal, isMittag)) {
          selected.push(meal);
          used.push(meal);
          available.splice(j, 1);
          const protein = getProteinType(meal);
          if (protein === 'fleisch') meatCount.fleisch++;
          else if (protein === 'fisch') meatCount.fisch++;
          else if (protein === 'vegan') meatCount.vegan++;
          if (isSuppe(meal)) meatCount.suppe++;
          found = true;
          break;
        }
      }
      if (!found && available.length > 0) {
        // Fallback: just pick the next available
        const meal = available.shift()!;
        selected.push(meal);
        used.push(meal);
      }
    }
    return selected;
  }

  const mittagMeals = selectMeals(mittagPool, usedMittag, true);
  const abendMeals = selectMeals(abendPool, usedAbend, false);

  // Build day plans
  const monday = getWeekMonday(new Date());
  const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

  const plans: DayPlan[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const dateStr = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.`;

    plans.push({
      dayName: dayNames[i],
      date: dateStr,
      mittag: mittagMeals[i] || null,
      abend: abendMeals[i] || null,
    });
  }

  return plans;
}

// Get protein counts for stats display
export function getProteinStats(plan: DayPlan[]): { fleisch: number; fisch: number; vegan: number; vegetarisch: number } {
  const stats = { fleisch: 0, fisch: 0, vegan: 0, vegetarisch: 0 };
  for (const day of plan) {
    for (const slot of [day.mittag, day.abend]) {
      if (!slot) continue;
      if (slot.tags.includes('fleisch')) stats.fleisch++;
      else if (slot.tags.includes('fisch')) stats.fisch++;
      else if (slot.tags.includes('vegan')) stats.vegan++;
      else stats.vegetarisch++;
    }
  }
  return stats;
}
