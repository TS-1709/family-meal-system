import React from 'react';
import { getWeekNumber } from '../lib/planner';

interface HeaderProps {
  dateRange: string;
}

export const Header: React.FC<HeaderProps> = ({ dateRange }) => {
  const kw = getWeekNumber(new Date());

  return (
    <header className="bg-forest-600 text-white px-5 pt-4 pb-3 rounded-b-2xl shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Familie Schroedl</h1>
          <p className="text-forest-200 text-xs mt-0.5">Wochenplan</p>
        </div>
        <div className="text-right">
          <span className="bg-forest-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            KW {kw}
          </span>
          <p className="text-forest-200 text-xs mt-1">{dateRange}</p>
        </div>
      </div>
    </header>
  );
};
