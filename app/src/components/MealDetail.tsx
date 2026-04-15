import React from 'react';
import { MealWithScore } from '../lib/types';

interface MealDetailProps {
  meal: MealWithScore | null;
  onClose: () => void;
}

function getProteinEmoji(meal: MealWithScore): string {
  if (meal.tags.includes('fleisch')) return '🍗';
  if (meal.tags.includes('fisch')) return '🐟';
  if (meal.tags.includes('vegan')) return '🌱';
  return '🥬';
}

function getDifficultyStars(difficulty: string): string {
  if (difficulty === 'leicht') return '⭐';
  if (difficulty === 'mittel') return '⭐⭐';
  return '⭐⭐⭐';
}

export const MealDetail: React.FC<MealDetailProps> = ({ meal, onClose }) => {
  if (!meal) return null;

  const emoji = getProteinEmoji(meal);
  const hasOffers = meal.matchedOffers.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-app mx-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="px-5 pb-8 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="flex items-start gap-3 mb-4">
            <span className="text-3xl">{emoji}</span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{meal.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{getDifficultyStars(meal.difficulty)} {meal.difficulty}</span>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500 capitalize">{meal.category}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {meal.tags.map((tag, i) => (
              <span
                key={i}
                className="text-xs bg-forest-50 text-forest-700 px-2 py-0.5 rounded-full font-medium"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Key ingredients */}
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Zutaten</h3>
            <ul className="space-y-1.5">
              {meal.key_ingredients.map((ing, i) => {
                const matched = meal.matchedOffers.find(m => m.ingredient === ing);
                return (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {matched ? (
                      <>
                        <span className="text-gold-500">💰</span>
                        <span className="font-medium text-gray-800">{ing.replace(/_/g, ' ')}</span>
                        <span className="ml-auto text-xs bg-gold-500 text-white px-1.5 py-0.5 rounded font-bold">
                          {matched.price.toFixed(2)}€
                        </span>
                        {matched.oldPrice && (
                          <span className="text-xs text-gray-400 line-through">
                            {matched.oldPrice.toFixed(2)}€
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-600">{ing.replace(/_/g, ' ')}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Offer highlight */}
          {hasOffers && (
            <div className="bg-gold-50 border border-gold-400/30 rounded-xl p-3 mb-4">
              <h3 className="text-sm font-semibold text-gold-600 mb-1.5">
                💰 Im Angebot bei ALDI SÜD
              </h3>
              <ul className="space-y-1">
                {meal.matchedOffers.map((m, i) => (
                  <li key={i} className="text-xs text-gray-700">
                    {m.offerName} —{' '}
                    <span className="font-bold text-gold-600">{m.price.toFixed(2)}€</span>
                    {m.oldPrice && (
                      <span className="ml-1 text-gray-400 line-through">{m.oldPrice.toFixed(2)}€</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Placeholder instructions */}
          <div className="bg-gray-50 rounded-xl p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-1.5">Zubereitung</h3>
            <p className="text-xs text-gray-500 italic">
              Zubereitungshinweise folgen... 🍳
            </p>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="mt-5 w-full bg-forest-600 text-white font-semibold py-3 rounded-xl active:bg-forest-700 transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </>
  );
};
