import React from 'react';
import { MealWithScore } from '../lib/types';

interface MealBadgeProps {
  meal: MealWithScore;
  label?: string;
}

function getProteinEmoji(meal: MealWithScore): string {
  if (meal.tags.includes('fleisch')) return '🍗';
  if (meal.tags.includes('fisch')) return '🐟';
  if (meal.tags.includes('vegan')) return '🌱';
  return '🥬';
}

export const MealBadge: React.FC<MealBadgeProps> = ({ meal, label }) => {
  const emoji = getProteinEmoji(meal);
  const hasOffer = meal.matchedOffers.length > 0;

  return (
    <div className="flex items-start gap-2">
      <span className="text-lg flex-shrink-0 mt-0.5">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800 leading-tight">
          {label && <span className="text-gray-400 text-xs mr-1">{label}</span>}
          {meal.name}
        </p>
        {hasOffer && (
          <span className="inline-flex items-center gap-0.5 mt-1 bg-gold-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            💰 im Angebot
          </span>
        )}
      </div>
    </div>
  );
};
