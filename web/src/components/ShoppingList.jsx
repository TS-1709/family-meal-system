import React, { useState, useEffect, useCallback } from 'react';

export default function ShoppingList({ categories, localStorageKey }) {
  const [checked, setChecked] = useState({});

  // Load state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(localStorageKey);
      if (saved) {
        setChecked(JSON.parse(saved));
      }
    } catch (e) {
      // ignore
    }
  }, [localStorageKey]);

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(checked));
    } catch (e) {
      // ignore
    }
  }, [checked, localStorageKey]);

  const toggleItem = useCallback((catName, itemIndex) => {
    setChecked(prev => {
      const key = `${catName}_${itemIndex}`;
      return { ...prev, [key]: !prev[key] };
    });
  }, []);

  // Count totals
  let totalItems = 0;
  let checkedItems = 0;
  const categoryData = [];

  for (const [catName, items] of Object.entries(categories || {})) {
    if (items.length === 0) continue;
    categoryData.push({ name: catName, items });
    for (let i = 0; i < items.length; i++) {
      totalItems++;
      const key = `${catName}_${i}`;
      if (checked[key]) checkedItems++;
    }
  }

  const allDone = checkedItems === totalItems && totalItems > 0;

  return (
    <div>
      {/* Progress */}
      <div className={`rounded-2xl p-4 shadow-sm mb-4 ${allDone ? 'bg-primary-900 text-white' : 'bg-white'}`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-semibold ${allDone ? 'text-white' : 'text-gray-800'}`}>
            🛒 Einkaufsliste
          </span>
          <span className={`text-sm font-bold ${allDone ? 'text-primary-200' : 'text-primary-900'}`}>
            {checkedItems} / {totalItems} eingekauft
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-900 rounded-full transition-all duration-300"
            style={{ width: totalItems > 0 ? `${(checkedItems / totalItems) * 100}%` : '0%' }}
          />
        </div>
        {allDone && (
          <p className="text-center text-sm mt-2 text-primary-200">
            ✅ Alles eingekauft!
          </p>
        )}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        {categoryData.map(({ name: catName, items }) => (
          <div key={catName} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {catName}
              </h3>
            </div>
            <div>
              {items.map((item, i) => {
                const key = `${catName}_${i}`;
                const isChecked = !!checked[key];
                return (
                  <button
                    key={i}
                    onClick={() => toggleItem(catName, i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-gray-50 ${
                      isChecked ? 'opacity-50' : ''
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isChecked
                        ? 'bg-primary-900 border-primary-900'
                        : 'border-gray-300'
                    }`}>
                      {isChecked && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm flex-1 ${isChecked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {item.name}
                    </span>
                    {item.count > 1 && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        ×{item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Reset button */}
      {checkedItems > 0 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setChecked({})}
            className="text-xs text-gray-400 underline"
          >
            Zurücksetzen
          </button>
        </div>
      )}
    </div>
  );
}
