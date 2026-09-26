/**
 * Cache pe durata unei randări: aceleași calcule grele (cifra zilei, tranșele plicurilor) erau
 * refăcute de 2–4 ori pe fiecare randare a Astăzi, trecând de fiecare dată prin tot registrul.
 *
 * Cheia e identitatea obiectelor (registrul, plicul) și ziua. Rezultatele sunt partajate:
 * cine le primește nu le modifică.
 */
type Node = { values: Map<string, unknown>; children: WeakMap<object, Node> };
let root: WeakMap<object, Node> | undefined;

const nodeFor = (map: WeakMap<object, Node>, owner: object) => {
  let node = map.get(owner);
  if (!node) { node = { values: new Map(), children: new WeakMap() }; map.set(owner, node); }
  return node;
};

/**
 * În aplicație registrul nu se modifică pe loc (orice schimbare face un obiect nou), deci
 * rezultatul poate rămâne legat de obiect cât trăiește: revenirea pe Astăzi, cu același
 * registru, nu mai refăcea toate socotelile. Testele construiesc date și le modifică pe loc
 * între apeluri; acolo cache-ul ține doar până la primul microtask.
 */
const perTick = import.meta.env?.MODE === "test";

export function tickMemo<T>(owners: [object, ...object[]], key: string, compute: () => T): T {
  if (!root) {
    root = new WeakMap();
    if (perTick) queueMicrotask(() => { root = undefined; });
  }
  let node = nodeFor(root, owners[0]);
  for (let index = 1; index < owners.length; index += 1) node = nodeFor(node.children, owners[index]);
  if (node.values.has(key)) return node.values.get(key) as T;
  const value = compute();
  node.values.set(key, value);
  return value;
}
