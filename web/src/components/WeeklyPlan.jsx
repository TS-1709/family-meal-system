import React, { useState } from 'react';
import { getProteinEmoji, hasOfferMatch } from '../planner';

export default function WeeklyPlan({ days, weekDates }) {
  const [expandedDay, setExpandedDay] = useState(null);

  const toggleDay = (index) => {
    setExpandedDay(expandedDay === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {days.map((day, i) => {
        const isExpanded = expandedDay === i;
        const date = weekDates[i];
        const isToday = isTodayCheck(date.date);

        return (
          <div
            key={i}
            className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${
              isToday ? 'ring-2 ring-primary-900 ring-opacity-30' : ''
            }`}
          >
            {/* Day Header */}
            <button
              onClick={() => toggleDay(i)}
              className="w-full px-4 py-3 flex items-center justify-between active:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${
                  isToday
                    ? 'bg-primary-900 text-white'
                    : 'bg-primary-50 text-primary-900'
                }`}>
                  {date.date.getDate()}
                </div>
                <div className="text-left">
                  <p className={`text-sm font-semibold ${isToday ? 'text-primary-900' : 'text-gray-800'}`}>
                    {date.name}
                    {isToday && <span className="text-xs font-normal text-primary-600 ml-2">Heute</span>}
                  </p>
                  <p className="text-xs text-gray-400">{date.dateStr}</p>
                </div>
              </div>
              <svg
                className={`w-5 h-5 text-gray-300 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Meals */}
            <div className="px-4 pb-3 space-y-2">
              <MealSlot
                label="Mittag"
                meal={day.mittag}
                isExpanded={isExpanded}
              />
              <MealSlot
                label="Abend"
                meal={day.abend}
                isExpanded={isExpanded}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MealSlot({ label, meal, isExpanded }) {
  if (!meal) {
    return (
      <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
        <span className="text-xs text-gray-400 w-14">{label}</span>
        <span className="text-xs text-gray-300 italic">Noch offen</span>
      </div>
    );
  }

  const emoji = getProteinEmoji(meal);
  const hasOffer = hasOfferMatch(meal);
  const isSchnell = (meal.tags || []).includes('schnell');

  return (
    <div className="py-2 px-3 bg-gray-50 rounded-xl">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-14 shrink-0">{label}</span>
        <span className="text-base">{emoji}</span>
        <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">
          {meal.name}
        </span>
        {hasOffer && (
          <span className="text-sm" title="Zutaten im Angebot">💰</span>
        )}
        {isSchnell && (
          <span className="text-xs bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded-full">⚡</span>
        )}
      </div>

      {/* Expanded ingredients */}
      {isExpanded && (
        <div className="mt-2 ml-16 flex flex-wrap gap-1">
          {(meal.key_ingredients || []).map((ing, j) => {
            const isOnSale = (meal.matchedIngredients || []).includes(ing);
            return (
              <span
                key={j}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isOnSale
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {ing.replace(/_/g, ' ')}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function isTodayCheck(date) {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}
