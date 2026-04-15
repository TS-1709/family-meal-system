import React, { useState, useEffect } from 'react';
import WeeklyPlan from './components/WeeklyPlan';
import ShoppingList from './components/ShoppingList';
import {
  matchMealsToOffers,
  selectWeek,
  distributeMealsToDays,
  buildShoppingList,
  findRelevantOffers,
  getWeekNumber,
  getWeekDates,
} from './planner';

export default function App() {
  const [mealsData, setMealsData] = useState(null);
  const [offersData, setOffersData] = useState(null);
  const [weekPlan, setWeekPlan] = useState(null);
  const [shoppingList, setShoppingList] = useState(null);
  const [relevantOffers, setRelevantOffers] = useState([]);
  const [activeTab, setActiveTab] = useState('plan');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [mealsRes, offersRes] = await Promise.all([
          fetch('./meals.json'),
          fetch('./current_offers.json'),
        ]);
        if (!mealsRes.ok || !offersRes.ok) throw new Error('Fehler beim Laden der Daten');

        const meals = await mealsRes.json();
        const offers = await offersRes.json();

        setMealsData(meals);
        setOffersData(offers);

        // Generate plan
        const weekNum = getWeekNumber();
        const scored = matchMealsToOffers(meals, offers);
        const selected = selectWeek(scored, weekNum);
        const days = distributeMealsToDays(selected);
        const allMeals = days.flatMap(d => [d.mittag, d.abend].filter(Boolean));
        const list = buildShoppingList(allMeals);
        const off = findRelevantOffers(offers, allMeals);

        setWeekPlan(days);
        setShoppingList(list);
        setRelevantOffers(off);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const weekDates = getWeekDates();
  const weekNum = getWeekNumber();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-900 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Lade Essensplan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center max-w-sm">
          <p className="text-red-500 text-lg mb-2">⚠️ Fehler</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-app mx-auto">
        {/* Header */}
        <header className="bg-primary-900 text-white px-4 pt-10 pb-5 rounded-b-3xl">
          <h1 className="text-xl font-bold text-center">Essensplan</h1>
          <p className="text-center text-primary-200 text-xs mt-1">
            KW {weekNum} · {weekDates[0].dateStr} – {weekDates[6].dateStr} · {offersData?.store || 'ALDI SÜD'}
          </p>
        </header>

        {/* Tab Bar */}
        <nav className="flex bg-white shadow-sm sticky top-0 z-10">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'plan'
                ? 'text-primary-900 border-b-2 border-primary-900'
                : 'text-gray-400 border-b-2 border-transparent'
            }`}
          >
            📅 Wochenplan
          </button>
          <button
            onClick={() => setActiveTab('shopping')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'shopping'
                ? 'text-primary-900 border-b-2 border-primary-900'
                : 'text-gray-400 border-b-2 border-transparent'
            }`}
          >
            🛒 Einkaufsliste
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
              activeTab === 'offers'
                ? 'text-primary-900 border-b-2 border-primary-900'
                : 'text-gray-400 border-b-2 border-transparent'
            }`}
          >
            💰 Angebote
          </button>
        </nav>

        {/* Content */}
        <main className="px-4 py-4 pb-8">
          {activeTab === 'plan' && (
            <WeeklyPlan
              days={weekPlan}
              weekDates={weekDates}
            />
          )}
          {activeTab === 'shopping' && (
            <ShoppingList
              categories={shoppingList}
              localStorageKey={`shopping_kw${weekNum}`}
            />
          )}
          {activeTab === 'offers' && (
            <OffersView
              offers={relevantOffers}
              store={offersData?.store}
              validFrom={offersData?.valid_from}
              validUntil={offersData?.valid_until}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="text-center text-gray-300 text-xs py-4">
          Familien Essensplaner · KW {weekNum}
        </footer>
      </div>
    </div>
  );
}

function OffersView({ offers, store, validFrom, validUntil }) {
  if (!offers || offers.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
        <p className="text-4xl mb-3">🛒</p>
        <p className="text-gray-500 text-sm">Keine passenden Angebote diese Woche</p>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-base font-semibold text-primary-900 mb-1">
          Diese Woche im Angebot
        </h2>
        <p className="text-xs text-gray-400">
          {store} · {validFrom} – {validUntil}
        </p>
      </div>

      <div className="space-y-2">
        {offers.map((offer, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{offer.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{offer.unit}</p>
            </div>
            <div className="text-right ml-3">
              <span className="text-base font-bold text-primary-900">
                {offer.price?.toFixed(2)} €
              </span>
              {offer.old_price && (
                <span className="block text-xs text-gray-400 line-through">
                  {offer.old_price?.toFixed(2)} €
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
