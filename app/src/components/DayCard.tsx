import React from 'react';
import { DayPlan } from '../lib/types';
import { MealBadge } from './MealBadge';

interface DayCardProps {
  plan: DayPlan;
  onMealClick: (meal: DayPlan['mittag']) => void;
}

export const DayCard: React.FC<DayCardProps> = ({ plan, onMealClick }) => {
  const today = new Date();
  const todayStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.`;
  const isToday = plan.date === todayStr;

  return (
    <div
      className={`flex-shrink-0 w-[280px] snap-center rounded-card p-4 shadow-md transition-all ${
        isToday
          ? 'bg-forest-50 border-2 border-forest-600 ring-1 ring-forest-200'
          : 'bg-white border border-gray-100'
      }`}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className={`text-sm font-bold ${isToday ? 'text-forest-700' : 'text-gray-700'}`}>
            {plan.dayName}
            {isToday && (
              <span className="ml-1.5 text-[10px] bg-forest-600 text-white px-1.5 py-0.5 rounded-full font-medium">
                Heute
              </span>
            )}
          </h3>
          <p className="text-xs text-gray-400">{plan.date}</p>
        </div>
      </div>

      {/* Meals */}
      <div className="space-y-3">
        {plan.mittag && (
          <button
            onClick={() => onMealClick(plan.mittag)}
            className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.98]"
          >
            <MealBadge meal={plan.mittag} label="Mittag" />
          </button>
        )}
        {plan.abend && (
          <button
            onClick={() => onMealClick(plan.abend)}
            className="w-full text-left p-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.98]"
          >
            <MealBadge meal={plan.abend} label="Abend" />
          </button>
        )}
      </div>
    </div>
  );
};
