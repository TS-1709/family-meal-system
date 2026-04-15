const STORAGE_PREFIX = 'mealplanner_';

export function getCheckedItems(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + 'checked');
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function saveCheckedItems(items: Set<string>): void {
  localStorage.setItem(STORAGE_PREFIX + 'checked', JSON.stringify([...items]));
}

export function toggleCheckedItem(id: string): Set<string> {
  const items = getCheckedItems();
  if (items.has(id)) {
    items.delete(id);
  } else {
    items.add(id);
  }
  saveCheckedItems(items);
  return items;
}

export function getOffersExpanded(): boolean {
  return localStorage.getItem(STORAGE_PREFIX + 'offers_expanded') === 'true';
}

export function setOffersExpanded(expanded: boolean): void {
  localStorage.setItem(STORAGE_PREFIX + 'offers_expanded', String(expanded));
}
