import { useState, useEffect, useCallback, useRef } from 'react'
import './index.css'

// Meal data (inline for standalone PWA)
const MEALS_DB = {
  family: { adults: 2, kids: [{ age: 3 }, { age: 5 }], plz: '92729' },
  meals: [
    { name: 'Paprika-Rinderhack-Pfanne', tags: ['fleisch', 'schnell', 'kind'], key_ingredients: ['rinderhack', 'paprika', 'zwiebeln', 'reis'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Butter Chicken mit Naan/Reis', tags: ['fleisch', 'indisch', 'kind'], key_ingredients: ['hähnchen', 'sahne', 'tomaten', 'reis'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Tikka Masala', tags: ['fleisch', 'indisch', 'kind'], key_ingredients: ['hähnchen', 'joghurt', 'tomaten', 'reis'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Hähnchengulasch', tags: ['fleisch', 'winter'], key_ingredients: ['hähnchen', 'paprika', 'tomaten', 'reis'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Spaghetti Bolognese', tags: ['fleisch', 'kind', 'klassiker'], key_ingredients: ['spaghetti', 'hackfleisch', 'tomatensoße', 'zwiebeln'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Lasagne', tags: ['fleisch', 'ofen', 'kind'], key_ingredients: ['lasagneplatten', 'hackfleisch', 'tomatensoße', 'béchamel'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Lachs Bowl', tags: ['fisch', 'gesund'], key_ingredients: ['lachs', 'reis', 'avocado', 'gemüse'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Lachsfilet mit Ofengemüse', tags: ['fisch', 'gesund', 'ofen'], key_ingredients: ['lachs', 'gemüse_mix', 'olivenöl', 'zitrone'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Fisch mit Brokkoli und Kartoffelgratin', tags: ['fisch', 'gesund', 'ofen'], key_ingredients: ['fischfilet', 'brokkoli', 'kartoffeln', 'sahne'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Risotto mit Lachs und Tomaten', tags: ['fisch', 'kind'], key_ingredients: ['lachs', 'risottoreis', 'tomaten', 'parmesan'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Indisches Curry (Gemüse)', tags: ['vegetarisch', 'indisch'], key_ingredients: ['kichererbsen', 'kokosmilch', 'gemüse', 'reis'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Kichererbsen Curry', tags: ['vegan', 'indisch'], key_ingredients: ['kichererbsen', 'kokosmilch', 'tomaten', 'reis'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Asia Lunch', tags: ['asien', 'schnell'], key_ingredients: ['reis', 'gemüse', 'sojasauce', 'ei'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Reis Bowl mit Tofu', tags: ['vegan', 'gesund'], key_ingredients: ['tofu', 'reis', 'gemüse', 'sojasauce'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Ofengemüse mit Hähnchenbrust', tags: ['fleisch', 'ofen', 'gesund'], key_ingredients: ['hähnchenbrust', 'gemüse', 'olivenöl', 'kräuter'], category: 'mittag', difficulty: 'leicht' },
    { name: 'Putengeschnetzltes', tags: ['fleisch', 'schnell'], key_ingredients: ['putenbrust', 'zwiebeln', 'sahne', 'reis_oder_spätzle'], category: 'mittag', difficulty: 'mittel' },
    { name: 'Spaghetti Carbonara', tags: ['fleisch', 'schnell'], key_ingredients: ['spaghetti', 'speck', 'eier', 'parmesan'], category: 'abend', difficulty: 'leicht' },
    { name: 'Cremiger Gnocchi Topf', tags: ['vegetarisch', 'kind'], key_ingredients: ['gnocchi', 'sahne', 'spinat', 'parmesan'], category: 'abend', difficulty: 'leicht' },
    { name: 'Nudeln mit Käse-Sahne-Soße', tags: ['vegetarisch', 'schnell', 'kind'], key_ingredients: ['nudeln', 'sahne', 'käse', 'knoblauch'], category: 'abend', difficulty: 'leicht' },
    { name: 'Käsespätzle', tags: ['vegetarisch', 'kind', 'klassiker'], key_ingredients: ['spätzle', 'käse', 'zwiebeln', 'butter'], category: 'abend', difficulty: 'mittel' },
    { name: 'Halloumi Burger', tags: ['vegetarisch', 'kind', 'burger'], key_ingredients: ['halloumi', 'burgerbrötchen', 'tomaten', 'salat'], category: 'abend', difficulty: 'leicht' },
    { name: 'Wraps', tags: ['flexibel', 'schnell', 'kind'], key_ingredients: ['tortilla_wraps', 'salat', 'käse', 'fleisch_oder_gemüse'], category: 'abend', difficulty: 'leicht' },
    { name: 'Pizza selbst gemacht', tags: ['kind', 'flexibel'], key_ingredients: ['mehl', 'tomatensoße', 'käse', 'belag_nach_wahl'], category: 'abend', difficulty: 'mittel' },
    { name: 'Gnocchi Caprese', tags: ['vegetarisch', 'schnell', 'kind'], key_ingredients: ['gnocchi', 'tomaten', 'mozzarella', 'basilikum'], category: 'abend', difficulty: 'leicht' },
    { name: 'Feta Nudeln', tags: ['vegetarisch', 'schnell'], key_ingredients: ['nudeln', 'feta', 'tomaten', 'olivenöl'], category: 'abend', difficulty: 'leicht' },
    { name: 'Kartoffelcremesuppe', tags: ['vegetarisch', 'suppe', 'kind'], key_ingredients: ['kartoffeln', 'zwiebeln', 'sahne', 'brühe'], category: 'abend', difficulty: 'leicht' },
    { name: 'Tomatensuppe mit Reis', tags: ['vegan', 'suppe', 'schnell', 'kind'], key_ingredients: ['tomaten_dose', 'reis', 'zwiebeln', 'brühe'], category: 'abend', difficulty: 'leicht' },
    { name: 'Bratkartoffeln mit Spiegelei', tags: ['vegetarisch', 'schnell', 'klassiker'], key_ingredients: ['kartoffeln', 'zwiebeln', 'eier', 'butter'], category: 'abend', difficulty: 'leicht' },
    { name: 'Ofenkartoffel mit Kräuterquark', tags: ['vegetarisch', 'schnell', 'gesund'], key_ingredients: ['kartoffeln', 'quark', 'kräuter', 'zwiebeln'], category: 'abend', difficulty: 'leicht' },
    { name: 'Gemüsesticks mit Hummus', tags: ['vegan', 'schnell', 'snack'], key_ingredients: ['kichererbsen_dose', 'möhren', 'gurke', 'paprika'], category: 'abend', difficulty: 'leicht' },
    { name: 'Brotzeitplatte', tags: ['flexibel', 'schnell', 'kind', 'klassiker'], key_ingredients: ['brot', 'aufschnitt', 'käse', 'gurke'], category: 'abend', difficulty: 'leicht' },
    { name: 'Quesadillas', tags: ['flexibel', 'schnell', 'kind'], key_ingredients: ['tortilla_wraps', 'käse', 'paprika', 'mais_dose'], category: 'abend', difficulty: 'leicht' },
    { name: 'Nudeln mit Pesto', tags: ['vegetarisch', 'schnell', 'kind'], key_ingredients: ['nudeln', 'pesto', 'parmesan', 'pinienkerne'], category: 'abend', difficulty: 'leicht' },
    { name: 'Tortellini in Sahnesoße', tags: ['fleisch', 'schnell', 'kind'], key_ingredients: ['tortellini', 'sahne', 'schinken', 'erbsen_tk'], category: 'abend', difficulty: 'leicht' },
    { name: 'Hackfleisch-Tomaten-Nudeln', tags: ['fleisch', 'schnell', 'kind'], key_ingredients: ['nudeln', 'hackfleisch', 'tomaten_dose', 'zwiebeln'], category: 'abend', difficulty: 'leicht' },
    { name: 'Kichererbsen Shakshuka', tags: ['vegetarisch', 'gesund'], key_ingredients: ['kichererbsen', 'tomaten', 'eier', 'paprika'], category: 'abend', difficulty: 'leicht' },
    { name: 'Grünkern-Chili-Cheese-Kartoffeln', tags: ['vegetarisch', 'gesund'], key_ingredients: ['grünkern', 'kartoffeln', 'käse', 'bohnen'], category: 'abend', difficulty: 'mittel' },
    { name: 'Möhren-Kartoffel-Eintopf', tags: ['vegetarisch', 'winter', 'kind'], key_ingredients: ['kartoffeln', 'möhren', 'zwiebeln', 'brühe'], category: 'abend', difficulty: 'leicht' },
    { name: 'Bohnensuppe', tags: ['vegan', 'winter'], key_ingredients: ['bohnen', 'tomaten', 'zwiebeln', 'reis'], category: 'abend', difficulty: 'leicht' },
    { name: 'Flammkuchen', tags: ['schnell', 'kind'], key_ingredients: ['mehl', 'schmand', 'zwiebeln', 'speck_oder_gemüse'], category: 'abend', difficulty: 'mittel' },
    { name: 'Pfannkuchen mit Apfelmus', tags: ['vegetarisch', 'schnell', 'kind', 'klassiker'], key_ingredients: ['mehl', 'eier', 'milch', 'apfelmus'], category: 'abend', difficulty: 'leicht' },
    { name: 'Toast Hawaii', tags: ['schnell', 'kind', 'klassiker'], key_ingredients: ['toast', 'schinken', 'käse', 'ananas_dose'], category: 'abend', difficulty: 'leicht' },
    { name: 'Couscous mit Gemüse', tags: ['vegan', 'schnell', 'gesund'], key_ingredients: ['couscous', 'gemüse', 'olivenöl', 'zitrone'], category: 'abend', difficulty: 'leicht' },
    { name: 'Griechischer Salat mit Fladenbrot', tags: ['vegetarisch', 'schnell', 'gesund'], key_ingredients: ['tomaten', 'gurke', 'feta', 'oliven'], category: 'abend', difficulty: 'leicht' },
  ]
}

// Current offers (ALDI SÜD KW 16)
const OFFERS = [
  { name: 'Hähnchenbrustfilet', price: 8.19, old: 9.99, store: 'ALDI', category: 'fleisch' },
  { name: 'Hackfleisch Rind', price: 5.29, old: 6.19, store: 'ALDI', category: 'fleisch' },
  { name: 'Schweine-Bratwurst', price: 1.99, old: 2.79, store: 'ALDI', category: 'fleisch' },
  { name: 'Chicken Nuggets', price: 4.99, old: 5.99, store: 'ALDI', category: 'fleisch' },
  { name: 'Lachsfilet', price: 10.99, old: 13.99, store: 'ALDI', category: 'fisch' },
  { name: 'Paprika rot', price: 1.79, store: 'ALDI', category: 'gemuese' },
  { name: 'Karotten 2kg', price: 1.59, store: 'ALDI', category: 'gemuese' },
  { name: 'Kartoffeln 2.5kg', price: 1.89, store: 'ALDI', category: 'gemuese' },
  { name: 'Zwiebeln 1.5kg', price: 1.11, store: 'ALDI', category: 'gemuese' },
  { name: 'Bio-Gurke', price: 0.77, store: 'ALDI', category: 'gemuese' },
  { name: 'Spargel', price: 3.99, store: 'ALDI', category: 'gemuese' },
  { name: 'Erdbeeren', price: 1.35, store: 'ALDI', category: 'obst' },
  { name: 'Mango', price: 1.11, store: 'ALDI', category: 'obst' },
  { name: 'Orangen Bio', price: 1.79, store: 'ALDI', category: 'obst' },
  { name: 'Basmatireis Bio', price: 1.69, old: 2.35, store: 'ALDI', category: 'trockenwaren' },
  { name: 'Joghurt 4x150g', price: 0.75, store: 'ALDI', category: 'milchprodukte' },
  { name: 'Schweinegulasch', price: 3.89, store: 'LIDL', category: 'fleisch' },
  { name: 'Hackfleisch Schwein', price: 2.69, store: 'LIDL', category: 'fleisch' },
  { name: 'Bockwurst', price: 3.49, store: 'LIDL', category: 'fleisch' },
  { name: 'Linguine', price: 0.69, old: 0.79, store: 'LIDL', category: 'trockenwaren' },
  { name: 'Penne Rigate', price: 0.69, old: 0.79, store: 'LIDL', category: 'trockenwaren' },
  { name: 'Lachsfilet Portionen', price: 7.99, store: 'LIDL', category: 'fisch' },
  { name: 'Kräuter-Butter', price: 1.49, store: 'REWE', category: 'milchprodukte' },
  { name: 'Hackfleisch gemischt', price: 2.99, store: 'REWE', category: 'fleisch' },
  { name: 'Räucherlachs', price: 3.39, store: 'REWE', category: 'fisch' },
  { name: 'Landleberwurst', price: 1.49, store: 'REWE', category: 'fleisch' },
]

const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

function getProteinType(meal) {
  const tags = new Set(meal.tags)
  if (tags.has('fleisch')) return 'fleisch'
  if (tags.has('fisch')) return 'fisch'
  if (tags.has('vegan')) return 'vegan'
  return 'vegetarisch'
}

function proteinIcon(type) {
  return { fleisch: '🍗', fisch: '🐟', vegan: '🌱', vegetarisch: '🥬' }[type] || '🍽️'
}

function proteinLabel(type) {
  return { fleisch: 'Fleisch', fisch: 'Fisch', vegan: 'Vegan', vegetarisch: 'Veggi' }[type] || ''
}

function generatePlan(seed) {
  const rng = (s) => { s = Math.sin(s) * 10000; return s - Math.floor(s) }
  let s = seed
  const shuffled = [...MEALS_DB.meals].sort(() => rng(s++) - 0.5)
  const mittag = shuffled.filter(m => m.category === 'mittag')
  const abend = shuffled.filter(m => m.category === 'abend')
  const counts = { fleisch: 0, fisch: 0, vegan: 0, vegetarisch: 0 }
  const maxP = { fleisch: 3, fisch: 2, vegan: 2, vegetarisch: 10 }
  const plan = []
  const used = new Set()

  for (const day of DAYS) {
    const dayPt = []
    for (const pool of [mittag, abend]) {
      for (const m of pool) {
        if (used.has(m.name)) continue
        const pt = getProteinType(m)
        if (counts[pt] >= maxP[pt]) continue
        if (dayPt.includes(pt) && ['fleisch', 'fisch'].includes(pt)) continue
        const slot = pool === mittag ? 'Mittag' : 'Abend'
        plan.push({ day, slot, ...m, proteinType: pt })
        used.add(m.name)
        counts[pt]++
        dayPt.push(pt)
        break
      }
    }
  }
  return plan
}

function getOfferForIngredient(name) {
  const n = name.toLowerCase().replace(/_/g, ' ')
  return OFFERS.find(o => n.includes(o.name.toLowerCase()) || o.name.toLowerCase().includes(n))
}

function buildShoppingList(plan) {
  const items = {}
  for (const meal of plan) {
    for (const ing of meal.key_ingredients) {
      const name = ing.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      items[name] = (items[name] || 0) + 1
    }
  }
  // Categorize
  const catKW = {
    '🥩 Fleisch': ['hähnchen', 'hackfleisch', 'rinderhack', 'schwein', 'puten', 'lachs', 'fisch', 'thunfisch', 'speck', 'schinken', 'tunfisch', 'wurst'],
    '🧀 Milchprodukte': ['käse', 'sahne', 'milch', 'joghurt', 'butter', 'eier', 'parmesan', 'mozzarella', 'feta', 'quark', 'halloumi'],
    '🍝 Nudeln & Reis': ['nudeln', 'reis', 'spaghetti', 'mehl', 'gnocchi', 'tortilla', 'brot', 'toast', 'spätzle', 'couscous', 'penne', 'lasagne'],
    '🥬 Gemüse & Obst': ['tomaten', 'paprika', 'zwiebeln', 'kartoffel', 'möhren', 'gurke', 'zucchini', 'spinat', 'brokkoli', 'avocado', 'salat', 'kräuter', 'bohnen', 'kichererbsen', 'knoblauch'],
  }
  const result = {}
  for (const [name, count] of Object.entries(items)) {
    let cat = '📦 Sonstiges'
    const nl = name.toLowerCase()
    for (const [c, kws] of Object.entries(catKW)) {
      if (kws.some(k => nl.includes(k))) { cat = c; break }
    }
    if (!result[cat]) result[cat] = []
    const offer = getOfferForIngredient(name)
    result[cat].push({ name, count, offer })
  }
  return result
}

// Swipe detection hook
function useSwipe(onLeft, onRight) {
  const ref = useRef(null)
  const startX = useRef(0)
  const startY = useRef(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const handleStart = (e) => {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    }
    const handleEnd = (e) => {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = e.changedTouches[0].clientY - startY.current
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) onLeft()
        else onRight()
      }
    }
    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchend', handleEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchend', handleEnd)
    }
  }, [onLeft, onRight])

  return ref
}

function App() {
  const today = new Date()
  const kw = getWeekNumber(today)
  const seed = kw * 100 + today.getFullYear()
  
  const [plan] = useState(() => generatePlan(seed))
  const [dayIndex, setDayIndex] = useState(Math.min(today.getDay() === 0 ? 6 : today.getDay() - 1, 6))
  const [view, setView] = useState('plan') // 'plan' | 'shopping'
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('dark') === 'true')
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`check_kw${kw}`) || '{}') } catch { return {} }
  })

  const shoppingList = useState(() => buildShoppingList(plan))[0]

  useEffect(() => {
    localStorage.setItem('dark', darkMode)
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem(`check_kw${kw}`, JSON.stringify(checked))
  }, [checked, kw])

  const goNext = useCallback(() => setDayIndex(i => Math.min(i + 1, 6)), [])
  const goPrev = useCallback(() => setDayIndex(i => Math.max(i - 1, 0)), [])
  const swipeRef = useSwipe(goNext, goPrev)

  const dayMeals = plan.filter(m => m.day === DAYS[dayIndex])
  const bg = darkMode ? 'bg-gray-950 text-gray-100' : 'bg-gray-50 text-gray-900'
  const card = darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-100'
  const accent = 'text-emerald-500'
  const totalItems = Object.values(shoppingList).flat().length
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-300`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 ${darkMode ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-lg border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">📋 Essensplan KW {kw}</h1>
            <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              ALDI · LIDL · REWE · 92729
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`w-9 h-9 rounded-full flex items-center justify-center text-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        
        {/* Tab Bar */}
        <div className="max-w-lg mx-auto px-4 flex gap-1 pb-2">
          <button
            onClick={() => setView('plan')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              view === 'plan' 
                ? 'bg-emerald-500 text-white' 
                : `${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`
            }`}
          >
            🍽️ Plan
          </button>
          <button
            onClick={() => setView('shopping')}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors relative ${
              view === 'shopping' 
                ? 'bg-emerald-500 text-white' 
                : `${darkMode ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`
            }`}
          >
            🛒 Einkauf ({checkedCount}/{totalItems})
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {view === 'plan' ? (
          <div ref={swipeRef} className="swipe-container">
            {/* Day Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goPrev}
                disabled={dayIndex === 0}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  dayIndex === 0 ? 'opacity-30' : `${darkMode ? 'bg-gray-800' : 'bg-gray-200'} active:scale-95`
                }`}
              >
                ←
              </button>
              <div className="text-center">
                <h2 className="text-xl font-bold">{DAYS[dayIndex]}</h2>
                <div className="flex gap-1 justify-center mt-1">
                  {DAYS.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        i === dayIndex ? 'bg-emerald-500' : darkMode ? 'bg-gray-700' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={goNext}
                disabled={dayIndex === 6}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                  dayIndex === 6 ? 'opacity-30' : `${darkMode ? 'bg-gray-800' : 'bg-gray-200'} active:scale-95`
                }`}
              >
                →
              </button>
            </div>

            {/* Day Card */}
            <div className={`day-card rounded-2xl border ${card} overflow-hidden shadow-sm`}>
              {dayMeals.map((meal, i) => {
                const pt = meal.proteinType
                const icon = proteinIcon(pt)
                const label = proteinLabel(pt)
                const hasOffer = meal.key_ingredients.some(ing => getOfferForIngredient(ing))
                
                return (
                  <div
                    key={i}
                    className={`p-4 ${i > 0 ? `border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            meal.slot === 'Mittag'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                          }`}>
                            {meal.slot}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            pt === 'fleisch' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : pt === 'fisch' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : pt === 'vegan' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`}>
                            {icon} {label}
                          </span>
                        </div>
                        <h3 className="font-semibold text-base leading-tight">{meal.name}</h3>
                        <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {meal.key_ingredients.map(i => i.replace(/_/g, ' ')).join(' · ')}
                        </p>
                      </div>
                      {hasOffer && (
                        <span className="offer-badge text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                          💰 Angebot
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Weekly Stats */}
            <div className={`mt-4 p-4 rounded-2xl border ${card}`}>
              <h3 className="text-sm font-semibold mb-3">📊 Diese Woche</h3>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { icon: '🍗', label: 'Fleisch', count: plan.filter(m => m.proteinType === 'fleisch').length },
                  { icon: '🐟', label: 'Fisch', count: plan.filter(m => m.proteinType === 'fisch').length },
                  { icon: '🌱', label: 'Vegan', count: plan.filter(m => m.proteinType === 'vegan').length },
                  { icon: '🥬', label: 'Veggi', count: plan.filter(m => m.proteinType === 'vegetarisch').length },
                ].map(({ icon, label, count }) => (
                  <div key={label} className={`p-2 rounded-xl ${darkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <div className="text-xl font-bold">{count}</div>
                    <div className="text-xs mt-0.5">{icon} {label}</div>
                  </div>
                ))}
              </div>
              <div className={`mt-3 pt-3 border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'} flex items-center justify-between text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                <span>💰 {OFFERS.length} Angebote</span>
                <span>🏪 ALDI · LIDL · REWE</span>
                <span>📍 92729</span>
              </div>
            </div>

            {/* Swipe hint */}
            <p className={`text-center text-xs mt-4 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
              ← Wischen für nächsten Tag →
            </p>
          </div>
        ) : (
          /* Shopping List View */
          <div>
            {Object.entries(shoppingList).map(([cat, items]) => (
              <div key={cat} className={`mb-4 rounded-2xl border ${card} overflow-hidden`}>
                <div className={`px-4 py-3 font-semibold text-sm ${darkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
                  {cat}
                </div>
                {items.map((item, i) => {
                  const key = `${cat}_${item.name}`
                  const isChecked = checked[key]
                  return (
                    <label
                      key={i}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer ${
                        i > 0 ? `border-t ${darkMode ? 'border-gray-800' : 'border-gray-100'}` : ''
                      } ${isChecked ? 'opacity-50' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={!!isChecked}
                        onChange={() => setChecked(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="w-5 h-5 rounded accent-emerald-500 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${isChecked ? 'line-through' : ''}`}>
                          {item.name}
                          {item.count > 1 && <span className="text-gray-400 ml-1">x{item.count}</span>}
                        </span>
                        {item.offer && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                              💰 {item.offer.price.toFixed(2)}€ {item.offer.store}
                            </span>
                            {item.offer.old && (
                              <span className="text-xs text-gray-400 line-through">
                                {item.offer.old.toFixed(2)}€
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            ))}
            
            {/* Progress */}
            <div className={`mt-4 p-4 rounded-2xl border ${card} text-center`}>
              <div className="text-2xl font-bold text-emerald-500">
                {checkedCount} / {totalItems}
              </div>
              <div className="text-sm text-gray-500 mt-1">eingekauft</div>
              {checkedCount === totalItems && (
                <div className="mt-2 text-lg">🎉 Geschafft!</div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`text-center py-6 text-xs ${darkMode ? 'text-gray-700' : 'text-gray-400'}`}>
        Hermes Meal Planner · KW {kw} · ALDI · LIDL · REWE
      </footer>
    </div>
  )
}

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export default App
