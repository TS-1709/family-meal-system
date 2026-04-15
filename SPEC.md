# Family Meal Planner — Web App Specification

## Overview
Build a beautiful, mobile-first web application for the Schroedl family meal planning system.
The app displays a weekly meal plan matched against current ALDI SÜD supermarket offers (PLZ 92729).

## Tech Stack
- **Framework:** React (Vite) + TypeScript
- **Styling:** Tailwind CSS v4
- **Data:** Static JSON (meals.json, current_offers.json already exist in /root/family-meal-system/)
- **No backend needed** — pure static SPA, data loaded at build/runtime from JSON files

## Design System
- **Primary Color:** Forest Green (#1a5c2e) — fresh, organic feel
- **Accent:** Gold (#f57f17) for "on offer" badges
- **Font:** Inter (system fallback: -apple-system)
- **Border Radius:** 12-16px (rounded cards)
- **Max Width:** 480px (mobile-first, centered)
- **Style:** Clean, modern, slightly playful — think Apple Fitness meets grocery app

## Features

### 1. Weekly Plan View (Home)
- Show 7 days as swipeable/scrollable horizontal cards
- Each day card shows: Day name, date, Mittag meal, Abend meal
- Each meal shows: name, protein type icon (🍗🐟🌱🥬), "im Angebot" badge if matched
- Protein distribution stats at top: "3x Fleisch · 2x Fisch · 2x Vegan · 7x Veggi"
- Smooth horizontal scroll with snap points (CSS scroll-snap)
- Current week number (KW) and date range in header

### 2. Shopping List View
- Swipeable to the right (or tab navigation)
- Ingredients grouped by category:
  - 🥩 Fleisch & Fisch
  - 🧀 Milchprodukte
  - 🍝 Nudeln & Reis
  - 🥬 Obst & Gemüse
  - 📦 Sonstiges
- Each item has a checkbox, strikethrough on check
- Counter: "8 / 24 eingekauft" with progress bar
- Persist checked state in localStorage
- Items on offer at ALDI get a 💰 badge with price

### 3. Meal Detail (Modal/Sheet)
- Tap on a meal → bottom sheet slides up
- Shows: meal name, category, difficulty, tags
- Key ingredients list
- "Im Angebot" section highlighting which ingredients are discounted this week
- Simple cooking instructions placeholder

### 4. Offer Highlights
- Small banner at top: "Diese Woche 12 Zutaten im Angebot bei ALDI SÜD"
- Tap to expand → list of all current offers with prices
- Old price crossed out, new price highlighted

## Data Structure

### meals.json (exists)
```json
{
  "family": "Schroedl",
  "members": {"adults": 2, "kids": [{"age": 3}, {"age": 5}]},
  "meals": [
    {
      "name": "Butter Chicken mit Naan/Reis",
      "tags": ["fleisch", "indisch", "kind"],
      "key_ingredients": ["hähnchen", "sahne", "tomaten", "reis"],
      "category": "mittag",
      "difficulty": "mittel"
    }
  ]
}
```

### current_offers.json (exists)
```json
{
  "store": "ALDI SÜD",
  "valid_from": "2026-04-13",
  "valid_until": "2026-04-19",
  "offers": [
    {
      "name": "Hähnchenbrustfilet Teilstück 1kg",
      "price": 8.19,
      "old_price": 9.99,
      "category": "fleisch"
    }
  ]
}
```

## Plan Generation Logic (TypeScript)
The app should generate the plan client-side using this algorithm:

1. **Score meals** by matching key_ingredients against offer names (fuzzy match)
2. **Sort** by offer_score descending, with random tiebreaker (seeded by KW number)
3. **Select 14 meals** (7 days × 2 slots: Mittag + Abend)
4. **Variety rules:**
   - Max 3 Fleisch per week
   - Max 2 Fisch per week
   - Max 2 Vegan per week
   - Max 2 Suppen/Eintopf per week
   - No same protein type (Fleisch/Fisch) for both meals on same day
   - No consecutive Suppen across slots
5. **Distribute** across days: first pick Mittag meals, then Abend meals

## File Structure
```
/root/family-meal-system/app/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   └── data/          ← copy meals.json & current_offers.json here
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── WeekPlan.tsx      ← horizontal day cards
│   │   ├── DayCard.tsx       ← single day card
│   │   ├── MealBadge.tsx     ← protein icon + offer badge
│   │   ├── ShoppingList.tsx  ← grouped checklist
│   │   ├── MealDetail.tsx    ← bottom sheet
│   │   ├── OfferBanner.tsx   ← offer highlights
│   │   └── Header.tsx        ← KW header
│   ├── lib/
│   │   ├── planner.ts        ← plan generation algorithm
│   │   ├── types.ts          ← TypeScript interfaces
│   │   └── storage.ts        ← localStorage helpers
│   └── data/                 ← or import directly
│       ├── meals.json
│       └── offers.json
```

## Key Interactions
- **Horizontal scroll** between days (CSS scroll-snap-type: x mandatory)
- **Tap meal** → bottom sheet with details (CSS transform + transition)
- **Checkbox tap** → strikethrough animation + counter update + localStorage save
- **Pull down** → regenerate plan (optional enhancement)

## Responsive
- Mobile first (375px - 480px)
- On desktop: centered card layout, max 480px
- No hamburger menu — everything visible via tabs/scroll

## Build & Deploy
- `npm run build` → static files in `dist/`
- Can be served by any static server
- Should work when opened as file:// too (no server needed)

## Constraints
- NO external API calls — all data is local JSON
- NO authentication
- NO backend
- Keep bundle size small (< 200KB gzipped)
- Must work offline after first load
