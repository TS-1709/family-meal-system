import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import mealsData from './data/meals.json'
import offersData from './data/offers.json'

// ─── Helpers ────────────────────────────────────────────────────────
function getKW() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7)
}

function getWeekRange() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  return `${fmt(monday)} – ${fmt(sunday)}.${now.getFullYear()}`
}

function getProteinType(meal) {
  const tags = new Set(meal.tags || [])
  if (tags.has('fleisch')) return 'fleisch'
  if (tags.has('fisch')) return 'fisch'
  if (tags.has('vegan')) return 'vegan'
  return 'vegetarisch'
}

function isSuppe(meal) {
  const n = (meal.name || '').toLowerCase()
  return n.includes('suppe') || n.includes('eintopf')
}

function scoreMeals(meals, offers) {
  const offerProducts = new Set()
  for (const o of offers.offers || []) {
    const name = (o.name || '').toLowerCase()
    offerProducts.add(name)
    for (const word of name.split(/\s+/)) {
      if (word.length > 3) offerProducts.add(word)
    }
  }
  return meals.map(meal => {
    let score = 0
    const matched = []
    for (const ing of (meal.key_ingredients || [])) {
      const ingL = ing.toLowerCase().replace(/_/g, ' ')
      for (const op of offerProducts) {
        if (ingL.includes(op) || op.includes(ingL)) {
          score++
          matched.push(ing)
          break
        }
      }
    }
    return { ...meal, offerScore: score, matchedIngredients: matched }
  })
}

function selectWeek(scoredMeals) {
  const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
  // Deterministic seed from KW
  const seed = getKW()
  const shuffled = [...scoredMeals].sort((a, b) => {
    const ha = (a.name.length * seed * 7) % 100
    const hb = (b.name.length * seed * 7) % 100
    return ha - hb
  })
  shuffled.sort((a, b) => b.offerScore - a.offerScore)

  const mittag = shuffled.filter(m => m.category === 'mittag')
  const abend = shuffled.filter(m => m.category === 'abend')

  const counts = { fleisch: 0, fisch: 0, vegan: 0, vegetarisch: 0 }
  const maxP = { fleisch: 3, fisch: 2, vegan: 2, vegetarisch: 10 }
  let suppeCount = 0
  const used = new Set()
  const plan = []

  for (const day of days) {
    const dayPt = []
    for (const pool of [mittag, abend]) {
      for (const m of pool) {
        if (used.has(m.name)) continue
        const pt = getProteinType(m)
        if (counts[pt] >= maxP[pt]) continue
        if (dayPt.includes(pt) && ['fleisch', 'fisch'].includes(pt)) continue
        if (isSuppe(m) && suppeCount >= 2) continue
        const slot = pool === mittag ? 'Mittag' : 'Abend'
        plan.push({ day, slot, ...m })
        used.add(m.name)
        counts[pt]++
        dayPt.push(pt)
        if (isSuppe(m)) suppeCount++
        break
      }
    }
  }
  return plan
}

function buildShoppingList(plan) {
  const items = {}
  for (const meal of plan) {
    for (const ing of (meal.key_ingredients || [])) {
      const name = ing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      items[name] = (items[name] || 0) + 1
    }
  }
  const categories = {
    '🥩 Fleisch & Fisch': [],
    '🧀 Milchprodukte': [],
    '🍝 Nudeln & Reis': [],
    '🥬 Obst & Gemüse': [],
    '📦 Sonstiges': [],
  }
  const meatKw = ['hähnchen', 'lachs', 'hackfleisch', 'rinderhack', 'puten', 'schweine', 'thunfisch', 'wiener', 'speck', 'schinken', 'fisch', 'dorade', 'cevapcici']
  const dairyKw = ['käse', 'sahne', 'milch', 'joghurt', 'butter', 'eier', 'parmesan', 'mozzarella', 'feta', 'halloumi', 'quark', 'ricotta', 'gorgonzola']
  const carbKw = ['nudeln', 'reis', 'mehl', 'brot', 'gnocchi', 'spaghetti', 'penne', 'tortilla', 'blätterteig', 'maultaschen', 'tortellini', 'couscous', 'burgerbrötchen', 'pita', 'baguette']
  const vegKw = ['tomaten', 'paprika', 'zwiebeln', 'möhren', 'kartoffeln', 'gurke', 'zucchini', 'spinat', 'brokkoli', 'blumenkohl', 'avocado', 'salat', 'kürbis', 'kichererbsen', 'bohnen', 'erbsen']

  for (const [ing, count] of Object.entries(items)) {
    const l = ing.toLowerCase()
    let placed = false
    for (const [kw, cat] of [[meatKw, '🥩 Fleisch & Fisch'], [dairyKw, '🧀 Milchprodukte'], [carbKw, '🍝 Nudeln & Reis'], [vegKw, '🥬 Obst & Gemüse']]) {
      if (kw.some(k => l.includes(k))) {
        categories[cat].push({ name: ing, count })
        placed = true
        break
      }
    }
    if (!placed) categories['📦 Sonstiges'].push({ name: ing, count })
  }
  return categories
}

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
const PROTEIN = {
  fleisch: { icon: '🍗', cls: 'tag-meat' },
  fisch: { icon: '🐟', cls: 'tag-fish' },
  vegan: { icon: '🌱', cls: 'tag-vegan' },
  vegetarisch: { icon: '🥬', cls: 'tag-veggi' },
}

// ─── Components ─────────────────────────────────────────────────────

function Header({ kw, stats, dark, onToggleDark, view, onViewChange }) {
  return (
    <div className="glass sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-bold text-forest-900 dark:text-forest-300">📋 Essensplan KW {kw}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{getWeekRange()} · ALDI SÜD</p>
        </div>
        <button
          onClick={onToggleDark}
          className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg card-press"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>
      <div className="flex gap-2 mb-2">
        {Object.entries(stats).map(([key, val]) => (
          <span key={key} className={`text-xs px-2 py-1 rounded-full ${PROTEIN[key]?.cls || 'bg-gray-100'}`}>
            {PROTEIN[key]?.icon} {val}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onViewChange('plan')}
          className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${view === 'plan' ? 'bg-forest-900 dark:bg-forest-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          📅 Plan
        </button>
        <button
          onClick={() => onViewChange('list')}
          className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${view === 'list' ? 'bg-forest-900 dark:bg-forest-700 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}
        >
          🛒 Einkauf
        </button>
      </div>
    </div>
  )
}

function MealCard({ meal }) {
  const pt = getProteinType(meal)
  const { icon, cls } = PROTEIN[pt]
  const isKid = (meal.tags || []).includes('kind')
  const hasOffer = meal.offerScore > 0
  const difficultyIcon = meal.difficulty === 'leicht' ? '⚡' : meal.difficulty === 'schwer' ? '🔥' : ''

  return (
    <div className="card p-3 card-press">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight">{meal.name}</h3>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cls}`}>{icon}</span>
            {isKid && <span className="text-[10px] px-1.5 py-0.5 rounded-full tag-kid">👶</span>}
            {hasOffer && <span className="text-[10px] px-1.5 py-0.5 rounded-full tag-offer">💰 Angebot</span>}
            {difficultyIcon && <span className="text-[10px]">{difficultyIcon}</span>}
          </div>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
          {meal.slot}
        </span>
      </div>
      {hasOffer && meal.matchedIngredients?.length > 0 && (
        <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mt-1.5">
          Im Angebot: {meal.matchedIngredients.map(i => i.replace(/_/g, ' ')).join(', ')}
        </p>
      )}
    </div>
  )
}

function DayView({ day, meals }) {
  const dayIndex = DAYS.indexOf(day)
  const today = new Date().getDay()
  const todayIndex = today === 0 ? 6 : today - 1
  const isToday = dayIndex === todayIndex

  return (
    <div className="swipe-page py-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className={`text-base font-bold ${isToday ? 'text-forest-600 dark:text-forest-400' : ''}`}>
          {day}
        </h2>
        {isToday && (
          <span className="text-[10px] bg-forest-100 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 px-2 py-0.5 rounded-full">
            HEUTE
          </span>
        )}
      </div>
      <div className="space-y-2">
        {meals.map((meal, i) => (
          <MealCard key={i} meal={meal} />
        ))}
      </div>
    </div>
  )
}

function WeekView({ plan }) {
  const byDay = useMemo(() => {
    const map = {}
    for (const m of plan) {
      if (!map[m.day]) map[m.day] = []
      map[m.day].push(m)
    }
    return map
  }, [plan])

  return (
    <div className="px-4 py-4 space-y-2">
      {DAYS.map(day => {
        const meals = byDay[day] || []
        if (!meals.length) return null
        const dayIndex = DAYS.indexOf(day)
        const today = new Date().getDay()
        const todayIndex = today === 0 ? 6 : today - 1
        const isToday = dayIndex === todayIndex

        return (
          <div key={day} className="card p-3">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`text-sm font-bold ${isToday ? 'text-forest-600 dark:text-forest-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {day}
              </h3>
              {isToday && <span className="text-[9px] bg-forest-100 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 px-1.5 py-0.5 rounded-full">HEUTE</span>}
            </div>
            {meals.map((meal, i) => {
              const pt = getProteinType(meal)
              const { icon } = PROTEIN[pt]
              const hasOffer = meal.offerScore > 0
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 border-t border-gray-50 dark:border-gray-800 first:border-0 first:pt-0">
                  <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">{meal.slot}</span>
                  <span className="text-sm flex-1">{meal.name}</span>
                  <span className="text-xs">{icon}</span>
                  {hasOffer && <span className="text-[10px]">💰</span>}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function ShoppingListView({ shoppingList, checked, onToggle }) {
  const totalItems = Object.values(shoppingList).flat().length
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">🛒 Einkaufsliste</h2>
        <span className="text-xs bg-forest-100 dark:bg-forest-900/40 text-forest-700 dark:text-forest-300 px-2 py-1 rounded-full">
          {checkedCount} / {totalItems} ✓
        </span>
      </div>
      <div className="space-y-4">
        {Object.entries(shoppingList).map(([category, items]) => {
          if (!items.length) return null
          return (
            <div key={category}>
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                {category}
              </h3>
              <div className="card divide-y divide-gray-50 dark:divide-gray-800">
                {items.sort((a, b) => a.name.localeCompare(b.name)).map((item, i) => {
                  const id = `${category}-${item.name}`
                  const isChecked = checked[id] || false
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isChecked ? 'bg-gray-50 dark:bg-gray-800/50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle(id)}
                        className="w-5 h-5 rounded accent-forest-600 flex-shrink-0"
                      />
                      <span className={`flex-1 text-sm transition-all ${isChecked ? 'line-through text-gray-400 dark:text-gray-500' : ''}`}>
                        {item.name}
                        {item.count > 1 && <span className="text-gray-400 ml-1">×{item.count}</span>}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {checkedCount === totalItems && totalItems > 0 && (
        <div className="mt-4 p-4 bg-forest-50 dark:bg-forest-900/30 rounded-2xl text-center">
          <p className="text-2xl mb-1">🎉</p>
          <p className="text-sm font-medium text-forest-700 dark:text-forest-300">Alles eingekauft!</p>
        </div>
      )}
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────────

export default function App() {
  const kw = getKW()
  const storageKey = `mealplan_kw${kw}`

  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('mealplan_dark')
    return saved !== 'false'
  })
  const [view, setView] = useState('plan')
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}_checked`) || '{}') } catch { return {} }
  })
  const [swipeIndex, setSwipeIndex] = useState(() => {
    const today = new Date().getDay()
    return today === 0 ? 6 : today - 1
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('mealplan_dark', dark)
  }, [dark])

  useEffect(() => {
    localStorage.setItem(`${storageKey}_checked`, JSON.stringify(checked))
  }, [checked, storageKey])

  const scoredMeals = useMemo(() => scoreMeals(mealsData.meals, offersData), [])
  const plan = useMemo(() => selectWeek(scoredMeals), [scoredMeals])
  const shoppingList = useMemo(() => buildShoppingList(plan), [plan])

  const stats = useMemo(() => {
    const s = { fleisch: 0, fisch: 0, vegan: 0, vegetarisch: 0 }
    for (const m of plan) s[getProteinType(m)]++
    return s
  }, [plan])

  const byDay = useMemo(() => {
    const map = {}
    for (const m of plan) {
      if (!map[m.day]) map[m.day] = []
      map[m.day].push(m)
    }
    return map
  }, [plan])

  const handleToggle = useCallback((id) => {
    setChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }, [])

  // Swipe handling
  const touchStart = useRef(null)
  const touchDelta = useRef(0)
  const trackRef = useRef(null)

  const onTouchStart = (e) => { touchStart.current = e.touches[0].clientX }
  const onTouchMove = (e) => {
    if (touchStart.current === null) return
    touchDelta.current = e.touches[0].clientX - touchStart.current
  }
  const onTouchEnd = () => {
    if (Math.abs(touchDelta.current) > 60) {
      if (touchDelta.current < 0 && swipeIndex < 6) setSwipeIndex(i => i + 1)
      if (touchDelta.current > 0 && swipeIndex > 0) setSwipeIndex(i => i - 1)
    }
    touchStart.current = null
    touchDelta.current = 0
  }

  // Day dots nav
  const DayDots = () => (
    <div className="flex justify-center gap-1.5 py-2">
      {DAYS.map((d, i) => (
        <button
          key={d}
          onClick={() => setSwipeIndex(i)}
          className={`w-2 h-2 rounded-full transition-all duration-200 ${i === swipeIndex ? 'bg-forest-600 dark:bg-forest-400 w-6' : 'bg-gray-300 dark:bg-gray-600'}`}
        />
      ))}
    </div>
  )

  return (
    <div className="min-h-screen max-w-lg mx-auto">
      <Header kw={kw} stats={stats} dark={dark} onToggleDark={() => setDark(d => !d)} view={view} onViewChange={setView} />

      {view === 'plan' ? (
        <>
          <div className="swipe-container" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <div
              ref={trackRef}
              className="swipe-track"
              style={{ transform: `translateX(-${swipeIndex * 100}%)` }}
            >
              {DAYS.map(day => (
                <div key={day} className="swipe-page">
                  <DayView day={day} meals={byDay[day] || []} />
                </div>
              ))}
            </div>
          </div>
          <DayDots />
          <div className="px-4 pb-4">
            <button
              onClick={() => setView('week')}
              className="w-full text-xs text-center text-gray-400 dark:text-gray-500 py-2"
            >
              Woche anzeigen ↓
            </button>
          </div>
        </>
      ) : view === 'week' ? (
        <>
          <WeekView plan={plan} />
          <div className="px-4 pb-4">
            <button
              onClick={() => setView('plan')}
              className="w-full text-xs text-center text-gray-400 dark:text-gray-500 py-2"
            >
              Zurück zum Tagesplan ↑
            </button>
            <button
              onClick={() => setView('list')}
              className="w-full text-xs text-center text-gray-400 dark:text-gray-500 py-2"
            >
              Zur Einkaufsliste →
            </button>
          </div>
        </>
      ) : (
        <>
          <ShoppingListView shoppingList={shoppingList} checked={checked} onToggle={handleToggle} />
          <div className="px-4 pb-4">
            <button
              onClick={() => setView('plan')}
              className="w-full text-xs text-center text-gray-400 dark:text-gray-500 py-2"
            >
              ← Zurück zum Plan
            </button>
          </div>
        </>
      )}

      <footer className="text-center text-[10px] text-gray-300 dark:text-gray-600 py-4 pb-8">
        Hermes · KW {kw} · ALDI SÜD · 157 Gerichte
      </footer>
    </div>
  )
}
