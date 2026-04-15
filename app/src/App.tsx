import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { MealsData, OffersData, DayPlan, MealWithScore } from './lib/types';
import { generateWeeklyPlan, getWeekNumber, getWeekMonday } from './lib/planner';
import { Header } from './components/Header';
import { OfferBanner } from './components/OfferBanner';
import { ShoppingList } from './components/ShoppingList';
import { MealDetail } from './components/MealDetail';
import { MealBadge } from './components/MealBadge';

type Tab = 'plan' | 'shopping';

const DAY_SHORTS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function App() {
  const [mealsData, setMealsData] = useState<MealsData | null>(null);
  const [offersData, setOffersData] = useState<OffersData | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealWithScore | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('plan');
  const [activeDay, setActiveDay] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    return day === 0 ? 6 : day - 1; // Monday=0 ... Sunday=6
  });
  const touchStartX = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    Promise.all([
      fetch('./data/meals.json').then(r => r.json()),
      fetch('./data/current_offers.json').then(r => r.json()),
    ]).then(([meals, offers]) => {
      setMealsData(meals);
      setOffersData(offers);
    }).catch(err => {
      console.error('Failed to load data:', err);
    });
  }, []);

  const plan = useMemo(() => {
    if (!mealsData || !offersData) return [];
    const kw = getWeekNumber(new Date());
    return generateWeeklyPlan(mealsData.meals, offersData.offers, kw);
  }, [mealsData, offersData]);

  const dateRange = useMemo(() => {
    const monday = getWeekMonday(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.`;
    return `${fmt(monday)} — ${fmt(sunday)}`;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    isSwiping.current = false;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      if (dx < 0 && activeDay < 6) setActiveDay(d => d + 1);
      else if (dx > 0 && activeDay > 0) setActiveDay(d => d - 1);
    }
  }, [activeDay]);

  const currentDay = plan[activeDay];

  // Today check helper
  const isToday = (dateStr: string) => {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}.`;
    return dateStr === todayStr;
  };

  if (!mealsData || !offersData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🍽️</div>
          <p className="text-sm text-gray-500">Lade Wochenplan...</p>
        </div>
      </div>
    );
  }

  // Compute protein stats
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

  return (
    <div className="min-h-screen bg-gray-50 max-w-app mx-auto relative pb-24">
      <Header dateRange={dateRange} />

      {activeTab === 'plan' ? (
        <>
          <OfferBanner offers={offersData.offers} />

          {/* Protein stats */}
          <div className="px-4 py-2 flex items-center justify-center gap-3 text-xs text-gray-600">
            <span className="flex items-center gap-1">🍗<span className="font-medium">{stats.fleisch}x</span></span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">🐟<span className="font-medium">{stats.fisch}x</span></span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">🌱<span className="font-medium">{stats.vegan}x</span></span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">🥬<span className="font-medium">{stats.vegetarisch}x</span></span>
          </div>

          {/* Day selector tabs */}
          <div className="flex mx-4 mt-1 mb-3 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide">
            {plan.map((day, i) => (
              <button
                key={i}
                onClick={() => setActiveDay(i)}
                className={`flex-1 min-w-[40px] text-xs font-medium py-2 px-1.5 rounded-lg transition-all whitespace-nowrap ${
                  activeDay === i
                    ? 'bg-white text-forest-700 shadow-sm'
                    : isToday(day.date)
                      ? 'text-forest-600 font-semibold'
                      : 'text-gray-500'
                }`}
              >
                {DAY_SHORTS[i]}
                {isToday(day.date) && activeDay !== i && <span className="ml-0.5">•</span>}
              </button>
            ))}
          </div>

          {/* Swipeable day card */}
          {currentDay && (
            <div
              className="px-4"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="bg-white rounded-2xl shadow-md overflow-hidden">
                {/* Day header */}
                <div className={`px-5 py-4 ${isToday(currentDay.date) ? 'bg-gradient-to-r from-forest-600 to-forest-500' : 'bg-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className={`text-lg font-bold ${isToday(currentDay.date) ? 'text-white' : 'text-gray-800'}`}>
                        {currentDay.dayName}
                        {isToday(currentDay.date) && (
                          <span className="ml-2 text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">
                            Heute
                          </span>
                        )}
                      </h2>
                      <p className={`text-xs ${isToday(currentDay.date) ? 'text-forest-200' : 'text-gray-400'}`}>{currentDay.date}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveDay(d => Math.max(0, d - 1))}
                        disabled={activeDay === 0}
                        className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-95 ${
                          isToday(currentDay.date) ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        ‹
                      </button>
                      <button
                        onClick={() => setActiveDay(d => Math.min(6, d + 1))}
                        disabled={activeDay === 6}
                        className={`w-8 h-8 rounded-full flex items-center justify-center disabled:opacity-30 active:scale-95 ${
                          isToday(currentDay.date) ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>

                {/* Meals */}
                <div className="p-4 space-y-3">
                  {currentDay.mittag && (
                    <button
                      onClick={() => setSelectedMeal(currentDay.mittag)}
                      className="w-full text-left p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.99] border border-gray-100"
                    >
                      <MealBadge meal={currentDay.mittag} label="Mittag" />
                    </button>
                  )}
                  {currentDay.abend && (
                    <button
                      onClick={() => setSelectedMeal(currentDay.abend)}
                      className="w-full text-left p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors active:scale-[0.99] border border-gray-100"
                    >
                      <MealBadge meal={currentDay.abend} label="Abendessen" />
                    </button>
                  )}
                </div>

                {/* Swipe hint */}
                <div className="text-center text-[10px] text-gray-300 pb-3">
                  ← wischen für nächsten Tag →
                </div>
              </div>

              {/* Mini week overview */}
              <div className="mt-4 grid grid-cols-7 gap-1.5">
                {plan.map((day, i) => {
                  const dayIsToday = isToday(day.date);
                  const hasOffer = (day.mittag?.matchedOffers?.length || 0) > 0 || (day.abend?.matchedOffers?.length || 0) > 0;
                  return (
                    <button
                      key={i}
                      onClick={() => setActiveDay(i)}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center text-[10px] font-medium transition-all ${
                        activeDay === i
                          ? 'bg-forest-600 text-white shadow-md'
                          : dayIsToday
                            ? 'bg-forest-100 text-forest-700 border border-forest-300'
                            : 'bg-white text-gray-500 border border-gray-100'
                      }`}
                    >
                      <span className="font-bold">{DAY_SHORTS[i]}</span>
                      <span className="text-[8px] mt-0.5 opacity-70">{day.date.split('.')[0]}.</span>
                      {hasOffer && activeDay !== i && <span className="text-[8px]">💰</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <ShoppingList plan={plan} offers={offersData.offers} />
      )}

      {/* Meal detail bottom sheet */}
      <MealDetail meal={selectedMeal} onClose={() => setSelectedMeal(null)} />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-app mx-auto bg-white/95 backdrop-blur-lg border-t border-gray-200 z-30">
        <div className="flex items-stretch h-16 safe-bottom">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'plan' ? 'text-forest-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'plan' ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <span className="text-[11px] font-semibold">Wochenplan</span>
            {activeTab === 'plan' && <div className="w-1 h-1 rounded-full bg-forest-600" />}
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'shopping' ? 'text-forest-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeTab === 'shopping' ? 2.5 : 1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-5.98.286h13.674M16.5 18.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM7.5 18.75a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 9l-4.5-4.5M15 9h4.5V4.5" />
            </svg>
            <span className="text-[11px] font-semibold">Einkaufsliste</span>
            {activeTab === 'shopping' && <div className="w-1 h-1 rounded-full bg-forest-600" />}
          </button>
        </div>
      </nav>
    </div>
  );
}

export default App;
