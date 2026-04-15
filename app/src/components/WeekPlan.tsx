import React from 'react';
import { DayPlan } from '../lib/types';
import { getProteinStats } from '../lib/planner';
import { DayCard } from './DayCard';

interface WeekPlanProps {
  plan: DayPlan[];
  onMealClick: (meal: DayPlan['mittag']) => void;
}

export const WeekPlan: React.FC<WeekPlanProps> = ({ plan, onMealClick }) => {
  const stats = getProteinStats(plan);
  const totalMeals = stats.fleisch + stats.fisch + stats.vegan + stats.vegetarisch;

  return (
    <div>
      {/* Stats bar */}
      <div className="px-4 py-3 flex items-center justify-center gap-3 text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span>🍗</span>
          <span className="font-medium">{stats.fleisch}x Fleisch</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="flex items-center gap-1">
          <span>🐟</span>
          <span className="font-medium">{stats.fisch}x Fisch</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="flex items-center gap-1">
          <span>🌱</span>
          <span className="font-medium">{stats.vegan}x Vegan</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="flex items-center gap-1">
          <span>🥬</span>
          <span className="font-medium">{stats.vegetarisch}x Veggi</span>
        </span>
      </div>

      {/* Horizontal scroll cards */}
      <div className="overflow-x-auto snap-x snap-mandatory pb-4 px-4 scrollbar-hide">
        <div className="flex gap-3">
          {plan.map((day, i) => (
            <DayCard key={i} plan={day} onMealClick={onMealClick} />
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div className="text-center text-[10px] text-gray-300 pb-2">
        ← wischen für mehr Tage →
      </div>
    </div>
  );
};
