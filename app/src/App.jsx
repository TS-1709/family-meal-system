import { useState, useEffect, useRef } from 'react'
import './index.css'
import mealsData from './meals.json'
import offersData from './offers.json'

const DAYS = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']
const KW = new Date().toLocaleDateString('de-DE',{ timeZone:'Europe/Berlin' })
  ? (() => { const d=new Date(); const start=new Date(d); start.setDate(d.getDate()-d.getDay()+1+(d.getDay()===0?-6:0)); return Math.ceil(((d-start)/(86400000)+start.getDay()+1)/7) })()
  : 16

function proteinType(meal) {
  const t = new Set(meal.tags||[])
  if (t.has('fleisch')) return 'fleisch'
  if (t.has('fisch')) return 'fisch'
  if (t.has('vegan')) return 'vegan'
  return 'veggi'
}

function isSuppe(name) {
  return /suppe|eintopf/i.test(name)
}

function generatePlan(meals, offers) {
  const offerWords = new Set()
  for (const o of offers.offers||[]) {
    const n = (o.name||'').toLowerCase()
    offerWords.add(n)
    n.split(/\s+/).forEach(w => { if(w.length>3) offerWords.add(w) })
  }

  const scored = meals.map(m => {
    let score = 0
    const matched = []
    for (const ing of (m.key_ingredients||[])) {
      const il = ing.toLowerCase().replace(/_/g,' ')
      for (const ow of offerWords) {
        if (il.includes(ow) || ow.includes(il)) { score++; matched.push(ing); break }
      }
    }
    return {...m, offerScore: score, matched}
  })

  // Deterministic shuffle by week number
  const seed = KW
  const shuffled = [...scored].sort((a,b) => {
    const ha = (a.name + seed).split('').reduce((h,c) => ((h<<5)-h)+c.charCodeAt(0),0)
    const hb = (b.name + seed).split('').reduce((h,c) => ((h<<5)-h)+c.charCodeAt(0),0)
    return ha - hb
  })
  shuffled.sort((a,b) => b.offerScore - a.offerScore)

  const mittag = shuffled.filter(m => m.category === 'mittag')
  const abend = shuffled.filter(m => m.category === 'abend')
  const counts = {fleisch:0, fisch:0, vegan:0, veggi:0}
  const maxP = {fleisch:3, fisch:2, vegan:2, veggi:10}
  const used = new Set()
  const plan = []
  let suppeCount = 0
  let prevSuppe = false

  for (const day of DAYS) {
    const dayP = []
    for (const pool of [mittag, abend]) {
      for (const m of pool) {
        if (used.has(m.name)) continue
        const pt = proteinType(m)
        if (counts[pt] >= maxP[pt]) continue
        if (dayP.includes(pt) && ['fleisch','fisch'].includes(pt)) continue
        if (isSuppe(m.name) && (suppeCount >= 2 || prevSuppe)) continue

        const slot = pool === mittag ? 'Mittag' : 'Abend'
        plan.push({day, slot, ...m})
        used.add(m.name)
        counts[pt]++
        dayP.push(pt)
        if (isSuppe(m.name)) { suppeCount++; prevSuppe = true } else { prevSuppe = false }
        break
      }
    }
  }
  return plan
}

function buildShopping(plan) {
  const items = {}
  for (const m of plan) {
    for (const ing of (m.key_ingredients||[])) {
      const name = ing.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
      items[name] = (items[name]||0) + 1
    }
  }

  const meatKw = ['hähnchen','lachs','hackfleisch','rinderhack','puten','schweine','thunfisch','wiener','speck','schinken','fisch','dorade','cevapcici']
  const dairyKw = ['käse','sahne','milch','joghurt','butter','eier','parmesan','mozzarella','feta','halloumi','quark','ricotta','gorgonzola']
  const carbKw = ['nudeln','reis','mehl','brot','toast','gnocchi','spaghetti','penne','tortilla','taco','blätterteig','maultaschen','tortellini','pinsa','burgerbrötchen','pita','baguette','fladenbrot','lasagneplatten','couscous','spätzle']
  const vegKw = ['tomaten','paprika','zwiebeln','möhren','kartoffeln','gurke','zucchini','spinat','brokkoli','blumenkohl','avocado','salat','kürbis','pak_choi','rote_bete','kichererbsen','bohnen','hummus','erbsen']

  const cats = {'🥩 Fleisch & Fisch':[],'🧀 Milchprodukte':[],'🍝 Nudeln & Reis':[],'🥬 Obst & Gemüse':[],'📦 Sonstiges':[]}

  for (const [name, count] of Object.entries(items)) {
    const nl = name.toLowerCase()
    let placed = false
    for (const [kws, cat] of [[meatKw,'🥩 Fleisch & Fisch'],[dairyKw,'🧀 Milchprodukte'],[carbKw,'🍝 Nudeln & Reis'],[vegKw,'🥬 Obst & Gemüse']]) {
      if (kws.some(k => nl.includes(k))) { cats[cat].push([name,count]); placed=true; break }
    }
    if (!placed) cats['📦 Sonstiges'].push([name,count])
  }
  return cats
}

const PT_ICONS = {fleisch:'🍗',fisch:'🐟',vegan:'🌱',veggi:'🥬'}
const PT_LABELS = {fleisch:'Fleisch',fisch:'Fisch',vegan:'Vegan',veggi:'Veggi'}

function App() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('meal_dark')
    if (saved !== null) return saved === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [view, setView] = useState('plan') // plan | shop
  const [dayIndex, setDayIndex] = useState(() => {
    const d = new Date().getDay()
    return d === 0 ? 6 : d - 1
  })
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`meal_checks_${KW}`)||'{}') } catch { return {} }
  })
  const [plan] = useState(() => generatePlan(mealsData.meals, offersData))
  const [shopping] = useState(() => buildShopping(plan))
  const swipeRef = useRef(null)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('meal_dark', dark)
  }, [dark])

  useEffect(() => {
    localStorage.setItem(`meal_checks_${KW}`, JSON.stringify(checked))
  }, [checked])

  const toggleCheck = (id) => {
    setChecked(prev => ({...prev, [id]: !prev[id]}))
  }

  const allItems = Object.entries(shopping).flatMap(([cat, items]) =>
    items.map(([name, count]) => ({name, count, cat, id: `${cat}_${name}`}))
  )
  const checkedCount = allItems.filter(i => checked[i.id]).length

  const dayMeals = plan.filter(m => m.day === DAYS[dayIndex])
  const proteinCounts = {}
  for (const m of plan) {
    const pt = proteinType(m)
    proteinCounts[pt] = (proteinCounts[pt]||0) + 1
  }

  const handleSwipe = (e) => {
    if (!swipeRef.current) return
    const scrollLeft = swipeRef.current.scrollLeft
    const width = swipeRef.current.offsetWidth
    const idx = Math.round(scrollLeft / width)
    if (idx !== dayIndex) setDayIndex(idx)
  }

  const scrollToDay = (idx) => {
    setDayIndex(idx)
    if (swipeRef.current) {
      swipeRef.current.scrollTo({left: idx * swipeRef.current.offsetWidth, behavior: 'smooth'})
    }
  }

  return (
    <div className="min-h-dvh" style={{background:'var(--bg)'}}>
      {/* Header */}
      <header className="sticky top-0 z-50 px-4 pt-3 pb-2" style={{background:'var(--bg)'}}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold" style={{color:'var(--green)'}}>📋 Essensplan</h1>
            <p className="text-xs" style={{color:'var(--text-muted)'}}>KW {KW} · ALDI SÜD · 92729</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all hover:scale-110"
              style={{background:'var(--card)',border:'1px solid var(--border)'}}
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Protein Stats */}
        <div className="flex gap-2 mb-3">
          {Object.entries(proteinCounts).map(([pt, count]) => (
            <div key={pt} className="flex-1 rounded-xl py-2 text-center" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
              <div className="text-lg">{PT_ICONS[pt]}</div>
              <div className="text-xs font-semibold" style={{color:'var(--text-muted)'}}>{count}× {PT_LABELS[pt]}</div>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-1 rounded-xl" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
          <button
            onClick={() => setView('plan')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${view==='plan' ? 'shadow-sm':''}`}
            style={view==='plan' ? {background:'var(--green)',color:'#fff'} : {color:'var(--text-muted)'}}
          >
            📅 Plan
          </button>
          <button
            onClick={() => setView('shop')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative ${view==='shop' ? 'shadow-sm':''}`}
            style={view==='shop' ? {background:'var(--green)',color:'#fff'} : {color:'var(--text-muted)'}}
          >
            🛒 Einkaufen
            {checkedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                style={{background:'#ef4444',color:'#fff',fontSize:'10px'}}>
                {checkedCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="px-4 pb-8">
        {view === 'plan' ? (
          <>
            {/* Day Selector */}
            <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  onClick={() => scrollToDay(i)}
                  className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all`}
                  style={i === dayIndex
                    ? {background:'var(--green)',color:'#fff',boxShadow:'0 2px 8px rgba(0,0,0,0.15)'}
                    : {background:'var(--card)',color:'var(--text-muted)',border:'1px solid var(--border)'}
                  }
                >
                  {day.slice(0,2)}
                </button>
              ))}
            </div>

            {/* Swipe Container */}
            <div
              ref={swipeRef}
              className="swipe-container"
              onScroll={handleSwipe}
              style={{marginLeft:'-16px',marginRight:'-16px'}}
            >
              {DAYS.map((day, i) => {
                const meals = plan.filter(m => m.day === day)
                return (
                  <div key={day} className="swipe-page">
                    <div className="animate-in">
                      <h2 className="text-lg font-bold mb-3" style={{color:'var(--green)'}}>{day}</h2>
                      {meals.map((m, j) => {
                        const pt = proteinType(m)
                        return (
                          <div key={j} className="card mb-3">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="text-xs font-semibold uppercase tracking-wide" style={{color:'var(--text-muted)'}}>
                                  {m.slot}
                                </span>
                                <h3 className="text-base font-semibold mt-0.5">{m.name}</h3>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <span className={`tag-${pt} text-xs px-2 py-1 rounded-lg font-medium`}>
                                  {PT_ICONS[pt]}
                                </span>
                                {m.offerScore > 0 && (
                                  <span className="offer-badge">💰 {m.offerScore}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {(m.key_ingredients||[]).map((ing, k) => (
                                <span key={k} className="text-xs px-2 py-0.5 rounded-md"
                                  style={{background:'var(--bg)',color:'var(--text-muted)'}}>
                                  {ing.replace(/_/g,' ')}
                                </span>
                              ))}
                            </div>
                            {m.difficulty && (
                              <div className="mt-2 text-xs" style={{color:'var(--text-muted)'}}>
                                {m.difficulty === 'leicht' ? '⚡ Einfach' : m.difficulty === 'mittel' ? '👨‍🍳 Mittel' : '🔥 Aufwändig'}
                                {m.tags?.has?.('schnell') || (m.tags||[]).includes('schnell') ? ' · ⏱ Schnell' : ''}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          /* Shopping List */
          <div className="animate-in">
            {/* Progress */}
            <div className="card mb-4 flex items-center gap-4">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--green)" strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2*Math.PI*24}`}
                    strokeDashoffset={`${2*Math.PI*24*(1-checkedCount/allItems.length)}`}
                    className="progress-ring"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{color:'var(--green)'}}>
                  {Math.round(checkedCount/allItems.length*100)}%
                </div>
              </div>
              <div>
                <div className="font-semibold">{checkedCount} von {allItems.length} eingekauft</div>
                <div className="text-xs" style={{color:'var(--text-muted)'}}>
                  {allItems.length - checkedCount} noch offen
                </div>
              </div>
              {checkedCount > 0 && (
                <button
                  onClick={() => setChecked({})}
                  className="ml-auto text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{background:'var(--bg)',color:'var(--text-muted)',border:'1px solid var(--border)'}}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Categories */}
            {Object.entries(shopping).map(([cat, items]) => {
              if (items.length === 0) return null
              return (
                <div key={cat} className="mb-4">
                  <h3 className="text-sm font-bold mb-2 px-1" style={{color:'var(--text-muted)'}}>{cat}</h3>
                  <div className="card">
                    {items.sort((a,b)=>a[0].localeCompare(b[0])).map(([name, count], i) => {
                      const id = `${cat}_${name}`
                      const isChecked = checked[id]
                      return (
                        <label key={id}
                          className={`flex items-center gap-3 py-3 cursor-pointer select-none ${i < items.length-1 ? 'border-b' : ''}`}
                          style={{borderColor:'var(--border)'}}
                          onClick={() => toggleCheck(id)}
                        >
                          <div
                            className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all ${isChecked ? 'check-pop' : ''}`}
                            style={isChecked
                              ? {background:'var(--green)',border:'2px solid var(--green)'}
                              : {border:'2px solid var(--border)'}
                            }
                          >
                            {isChecked && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className={`flex-1 text-sm transition-all ${isChecked ? 'line-through opacity-40' : ''}`}>
                            {name}
                          </span>
                          {count > 1 && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md"
                              style={{background:'var(--bg)',color:'var(--text-muted)'}}>
                              ×{count}
                            </span>
                          )}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs" style={{color:'var(--text-muted)'}}>
        Hermes · KW {KW} · {offersData.offers?.length||0} ALDI Angebote · {mealsData.meals?.length||0} Gerichte
      </footer>
    </div>
  )
}

export default App
