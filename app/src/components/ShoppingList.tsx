import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingItem, IngredientCategory, CATEGORY_CONFIG, DayPlan, Offer, MealWithScore } from '../lib/types';
import { getCheckedItems, toggleCheckedItem } from '../lib/storage';

interface ShoppingListProps {
  plan: DayPlan[];
  offers: Offer[];
}

// Categorize an ingredient
function categorizeIngredient(ingredient: string): IngredientCategory {
  const ing = ingredient.toLowerCase();
  if (/hähnchen|lachs|fisch|hackfleisch|schwein|pute|thunfisch|bratwurst|wiener|salami|schinken|speck|cevapcici|gyros/.test(ing))
    return 'fleisch_fisch';
  if (/sahne|käse|parmesan|mozzarella|joghurt|quark|milch|butter|feta|ricotta|gorgonzola|schmand|halloumi|béchamel/.test(ing))
    return 'milchprodukte';
  if (/nudeln|reis|spaghetti|penne|gnocchi|spätzle|tortellini|maultaschen|lasagne|hirse|blätterteig|tortilla|wraps|taco|pinsa/.test(ing))
    return 'nudeln_reis';
  if (/tomaten|paprika|zwiebel|kartoffel|salat|spinat|gurke|zucchini|brokkoli|avocado|karotten|möhren|bohnen|kichererbsen|gemüse|basilikum|knoblauch|kräuter|erbsen|kürbis|blumenkohl|tofu/.test(ing))
    return 'obst_gemuese';
  return 'sonstiges';
}

// Find matching offer for an ingredient
function findOffer(ingredient: string, offers: Offer[]): Offer | undefined {
  const ing = ingredient.toLowerCase().replace(/_/g, ' ');
  const mappings: Record<string, string[]> = {
    'hähnchen': ['hähnchen'],
    'hähnchenbrust': ['hähnchen'],
    'hähnchenschnitzel': ['hähnchen', 'nuggets'],
    'lachs': ['lachs'],
    'rinderhack': ['hackfleisch', 'rind'],
    'hackfleisch': ['hackfleisch'],
    'paprika': ['paprika'],
    'zwiebeln': ['zwiebel'],
    'kartoffeln': ['kartoffel'],
    'möhren': ['karotten'],
    'gurke': ['gurke'],
    'reis': ['reis'],
    'bratwurst': ['bratwurst'],
  };

  const parts = ing.split(/[\/_\s]+/).filter(p => p.length > 2);
  for (const part of parts) {
    const searchTerms = mappings[part] || [part];
    for (const offer of offers) {
      const offerLower = offer.name.toLowerCase();
      if (searchTerms.some(term => offerLower.includes(term))) {
        return offer;
      }
    }
  }
  return undefined;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({ plan, offers }) => {
  const [checked, setChecked] = useState<Set<string>>(getCheckedItems);

  // Generate shopping list from plan
  const items = useMemo(() => {
    const ingredientSet = new Map<string, ShoppingItem>();

    for (const day of plan) {
      for (const slot of [day.mittag, day.abend]) {
        if (!slot) continue;
        for (const ing of slot.key_ingredients) {
          const id = ing.toLowerCase().replace(/\s+/g, '_');
          if (!ingredientSet.has(id)) {
            const offer = findOffer(ing, offers);
            ingredientSet.set(id, {
              id,
              name: ing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              category: categorizeIngredient(ing),
              onOffer: !!offer,
              offerPrice: offer?.price,
              offerOldPrice: offer?.old_price,
            });
          }
        }
      }
    }

    return [...ingredientSet.values()].sort((a, b) => {
      const catDiff = CATEGORY_CONFIG[a.category].order - CATEGORY_CONFIG[b.category].order;
      if (catDiff !== 0) return catDiff;
      return a.name.localeCompare(b.name);
    });
  }, [plan, offers]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<IngredientCategory, ShoppingItem[]> = {
      fleisch_fisch: [],
      milchprodukte: [],
      nudeln_reis: [],
      obst_gemuese: [],
      sonstiges: [],
    };
    for (const item of items) {
      groups[item.category].push(item);
    }
    return groups;
  }, [items]);

  const totalItems = items.length;
  const checkedCount = items.filter(item => checked.has(item.id)).length;
  const progress = totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;

  const handleToggle = (id: string) => {
    const newChecked = toggleCheckedItem(id);
    setChecked(newChecked);
  };

  return (
    <div className="px-4 py-3">
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-700">Einkaufsliste</span>
          <span className="text-xs text-gray-500">
            {checkedCount} / {totalItems} eingekauft
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-forest-600 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      {(Object.entries(grouped) as [IngredientCategory, ShoppingItem[]][]).map(
        ([cat, catItems]) => {
          if (catItems.length === 0) return null;
          const config = CATEGORY_CONFIG[cat];
          return (
            <div key={cat} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <span>{config.icon}</span>
                {config.label}
              </h3>
              <ul className="space-y-0.5">
                {catItems.map(item => {
                  const isChecked = checked.has(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => handleToggle(item.id)}
                        className={`w-full flex items-center gap-3 py-2 px-3 rounded-xl text-left transition-all active:scale-[0.99] ${
                          isChecked ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isChecked
                              ? 'bg-forest-600 border-forest-600'
                              : 'border-gray-300'
                          }`}
                        >
                          {isChecked && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        {/* Name */}
                        <span
                          className={`flex-1 text-sm transition-all ${
                            isChecked ? 'line-through text-gray-400' : 'text-gray-700'
                          }`}
                        >
                          {item.name}
                        </span>

                        {/* Offer badge */}
                        {item.onOffer && (
                          <span className="flex items-center gap-1 text-xs">
                            <span className="text-gold-500">💰</span>
                            <span className="font-bold text-gold-600">
                              {item.offerPrice?.toFixed(2)}€
                            </span>
                            {item.offerOldPrice && (
                              <span className="text-gray-400 line-through text-[10px]">
                                {(item.offerOldPrice as number).toFixed(2)}€
                              </span>
                            )}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }
      )}
    </div>
  );
};
