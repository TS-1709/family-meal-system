export interface Meal {
  name: string;
  tags: string[];
  key_ingredients: string[];
  category: 'mittag' | 'abend' | 'frühstück';
  difficulty: 'leicht' | 'mittel' | 'schwer';
}

export interface MealsData {
  family: string;
  members: { adults: number; kids: { age: number }[] };
  plz: string;
  store: string;
  preferences: { diet: string; notes: string[] };
  meals: Meal[];
}

export interface Offer {
  name: string;
  price: number;
  old_price: number | null;
  unit: string;
  category: string;
}

export interface OffersData {
  store: string;
  date: string;
  valid_from: string;
  valid_until: string;
  source: string;
  offers: Offer[];
}

export interface DayPlan {
  dayName: string;
  date: string;
  mittag: MealWithScore | null;
  abend: MealWithScore | null;
}

export interface MealWithScore extends Meal {
  offerScore: number;
  matchedOffers: MatchedOffer[];
}

export interface MatchedOffer {
  ingredient: string;
  offerName: string;
  price: number;
  oldPrice: number | null;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: IngredientCategory;
  onOffer: boolean;
  offerPrice?: number;
  offerOldPrice?: number | number | null;
}

export type IngredientCategory =
  | 'fleisch_fisch'
  | 'milchprodukte'
  | 'nudeln_reis'
  | 'obst_gemuese'
  | 'sonstiges';

export const CATEGORY_CONFIG: Record<IngredientCategory, { label: string; icon: string; order: number }> = {
  fleisch_fisch: { label: 'Fleisch & Fisch', icon: '🥩', order: 0 },
  milchprodukte: { label: 'Milchprodukte', icon: '🧀', order: 1 },
  nudeln_reis: { label: 'Nudeln & Reis', icon: '🍝', order: 2 },
  obst_gemuese: { label: 'Obst & Gemüse', icon: '🥬', order: 3 },
  sonstiges: { label: 'Sonstiges', icon: '📦', order: 4 },
};

export const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
export const DAY_NAMES_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
