/**
 * Memorie pentru funcții pure de text: normalizarea diacriticelor și curățarea numelui de
 * comerciant rulau pe fiecare mișcare la fiecare randare (5.000 de rânduri = sute de ms
 * pe un telefon slab). Aceleași intrări revin mereu, deci rezultatul se ține minte.
 * Plafonul golește memoria când crește prea mult; nu e LRU, dar nu are nevoie să fie.
 */
export function memoString<T>(fn: (value: string) => T, limit = 20_000): (value: string) => T {
  const cache = new Map<string, T>();
  return (value: string) => {
    const hit = cache.get(value);
    if (hit !== undefined) return hit;
    const result = fn(value);
    if (cache.size >= limit) cache.clear();
    cache.set(value, result);
    return result;
  };
}
