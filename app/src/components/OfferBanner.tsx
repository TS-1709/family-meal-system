import React, { useState, useEffect } from 'react';
import { Offer } from '../lib/types';
import { getOffersExpanded, setOffersExpanded } from '../lib/storage';

interface OfferBannerProps {
  offers: Offer[];
}

export const OfferBanner: React.FC<OfferBannerProps> = ({ offers }) => {
  const [expanded, setExpanded] = useState(getOffersExpanded);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    setOffersExpanded(next);
  };

  // Count food-related offers
  const foodCategories = ['fleisch', 'fisch', 'milchprodukte', 'gemuese', 'obst', 'trockenwaren'];
  const foodOffers = offers.filter(o => foodCategories.includes(o.category));

  return (
    <div className="mx-4 mt-3">
      {/* Banner */}
      <button
        onClick={toggle}
        className="w-full bg-gradient-to-r from-gold-500 to-gold-600 text-white rounded-xl px-4 py-3 flex items-center justify-between shadow-md active:scale-[0.99] transition-transform"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏷️</span>
          <span className="text-sm font-semibold">
            Diese Woche {foodOffers.length} Zutaten im Angebot
          </span>
        </div>
        <span className="text-xs opacity-80">bei ALDI SÜD</span>
      </button>

      {/* Expanded offers list */}
      {expanded && (
        <div className="mt-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-50">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Alle Angebote diese Woche
            </h3>
          </div>
          <ul className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
            {offers.map((offer, i) => (
              <li key={i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{offer.name}</p>
                  {offer.unit && (
                    <p className="text-[10px] text-gray-400">{offer.unit}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-sm font-bold text-forest-700">
                    {offer.price.toFixed(2)}€
                  </span>
                  {offer.old_price && (
                    <span className="ml-1.5 text-xs text-gray-400 line-through">
                      {offer.old_price.toFixed(2)}€
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
