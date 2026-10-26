import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const STORAGE_PREFIX = 'kabakaba.student.cart.v2';
const LEGACY_KEYS = ['kabakaba.student.cart.v1', 'kabakaba.student.cart'];

const initial = { orders: [] };

function plateId() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function blankOrder(vendorId, vendorName) {
  return {
    vendorId,
    vendorName: vendorName || 'Cantine',
    consumptionMode: 'ON_SITE',
    takeawayOptionId: null,
    when: 'NOW',
    scheduleAt: '',
    plates: [],
  };
}

export function plateTotal(plate) {
  const parts = plate?.quantity || 0;
  return (plate?.lines || []).reduce(
    (sum, line) => sum + parts * (line.quantity || 0) * (line.unitPrice || 0),
    0,
  );
}

export function orderSubtotal(order) {
  return (order?.plates || []).reduce((sum, plate) => sum + plateTotal(plate), 0);
}

/** Lignes envoyées à l’API : quantités regroupées par article. */
export function orderItems(order) {
  const map = new Map();
  for (const plate of order?.plates || []) {
    const parts = plate.quantity || 0;
    if (parts < 1) continue;
    for (const line of plate.lines || []) {
      const quantity = (line.quantity || 0) * parts;
      if (quantity < 1) continue;
      const key = line.menuId ? `m:${line.menuId}` : `c:${line.componentId}`;
      const prev = map.get(key);
      if (prev) prev.quantity += quantity;
      else map.set(key, { ...line, quantity });
    }
  }
  return [...map.values()];
}

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}.${userId}` : STORAGE_PREFIX;
}

function asPlate(raw) {
  const lines = Array.isArray(raw?.lines)
    ? raw.lines.filter((line) => line && (line.menuId || line.componentId) && (line.quantity || 0) > 0)
    : [];
  if (!lines.length) return null;
  return {
    id: raw.id || plateId(),
    title: raw.title || lines[0].name || 'Plat',
    quantity: Math.max(1, Number(raw.quantity) || 1),
    lines: lines.map((line) => ({
      componentId: line.componentId || null,
      menuId: line.menuId || null,
      name: line.name || 'Article',
      unitPrice: Number(line.unitPrice) || 0,
      quantity: Math.max(1, Number(line.quantity) || 1),
      soldAlone: Boolean(line.soldAlone),
    })),
  };
}

function asOrder(raw) {
  const plates = (raw?.plates || []).map(asPlate).filter(Boolean);
  if (!raw?.vendorId || !plates.length) return null;
  return {
    vendorId: raw.vendorId,
    vendorName: raw.vendorName || 'Cantine',
    consumptionMode: raw.consumptionMode === 'TAKEAWAY' ? 'TAKEAWAY' : 'ON_SITE',
    takeawayOptionId: raw.takeawayOptionId || null,
    when: raw.when === 'LATER' ? 'LATER' : 'NOW',
    scheduleAt: raw.scheduleAt || '',
    plates,
  };
}

function fromLegacy(parsed) {
  const lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
  if (!parsed?.vendorId || !lines.length) return initial;
  const order = asOrder({
    vendorId: parsed.vendorId,
    vendorName: parsed.vendorName,
    consumptionMode: parsed.consumptionMode,
    takeawayOptionId: parsed.takeawayOptionId,
    plates: lines.map((line) => ({
      title: line.name,
      quantity: 1,
      lines: [line],
    })),
  });
  return order ? { orders: [order] } : initial;
}

function normalizeStored(parsed) {
  if (!parsed || typeof parsed !== 'object') return initial;
  if (Array.isArray(parsed.orders)) {
    return { orders: parsed.orders.map(asOrder).filter(Boolean) };
  }
  return fromLegacy(parsed);
}

function loadCart(userId) {
  try {
    const raw =
      localStorage.getItem(storageKey(userId)) ||
      LEGACY_KEYS.map((key) => localStorage.getItem(userId ? `${key}.${userId}` : key)).find(Boolean) ||
      localStorage.getItem(LEGACY_KEYS[0]) ||
      localStorage.getItem(LEGACY_KEYS[1]);
    if (!raw) return initial;
    return normalizeStored(JSON.parse(raw));
  } catch {
    return initial;
  }
}

function saveCart(userId, state) {
  const key = storageKey(userId);
  if (!state.orders.length) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify({ orders: state.orders }));
}

function updateOrder(state, vendorId, recipe) {
  const orders = state.orders
    .map((order) => (order.vendorId === vendorId ? recipe(order) : order))
    .filter((order) => order.plates.length);
  return { orders };
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'addPlate': {
      const plate = asPlate(action.plate);
      if (!plate || !action.plate?.vendorId) return state;
      const existing = state.orders.find((order) => order.vendorId === action.plate.vendorId);
      if (!existing) {
        return {
          orders: [
            ...state.orders,
            {
              ...blankOrder(action.plate.vendorId, action.plate.vendorName),
              plates: [plate],
            },
          ],
        };
      }
      return updateOrder(state, action.plate.vendorId, (order) => ({
        ...order,
        vendorName: action.plate.vendorName || order.vendorName,
        plates: [...order.plates, plate],
      }));
    }
    case 'setPlateQty':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        plates: order.plates
          .map((plate) =>
            plate.id === action.plateId ? { ...plate, quantity: action.quantity } : plate,
          )
          .filter((plate) => plate.quantity > 0),
      }));
    case 'removePlate':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        plates: order.plates.filter((plate) => plate.id !== action.plateId),
      }));
    case 'setConsumption':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        consumptionMode: action.mode,
        takeawayOptionId: action.mode === 'TAKEAWAY' ? order.takeawayOptionId : null,
      }));
    case 'setTakeaway':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        takeawayOptionId: action.id,
      }));
    case 'setWhen':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        when: action.when,
      }));
    case 'setScheduleAt':
      return updateOrder(state, action.vendorId, (order) => ({
        ...order,
        scheduleAt: action.value,
      }));
    case 'dropOrder':
      return { orders: state.orders.filter((order) => order.vendorId !== action.vendorId) };
    case 'clear':
      return initial;
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const skipPersist = useRef(true);
  const [state, dispatch] = useReducer(reducer, initial, () => loadCart(userId));

  useEffect(() => {
    skipPersist.current = true;
    dispatch({ type: 'hydrate', state: loadCart(userId) });
  }, [userId]);

  useEffect(() => {
    if (skipPersist.current) {
      skipPersist.current = false;
      return;
    }
    saveCart(userId, state);
  }, [state, userId]);

  const value = useMemo(() => {
    const itemCount = state.orders.reduce(
      (sum, order) => sum + order.plates.reduce((plates, plate) => plates + plate.quantity, 0),
      0,
    );
    const subtotal = state.orders.reduce((sum, order) => sum + orderSubtotal(order), 0);
    return {
      orders: state.orders,
      itemCount,
      subtotal,
      addPlate: (plate) => dispatch({ type: 'addPlate', plate }),
      setPlateQty: (vendorId, plateId, quantity) =>
        dispatch({ type: 'setPlateQty', vendorId, plateId, quantity }),
      removePlate: (vendorId, plateId) => dispatch({ type: 'removePlate', vendorId, plateId }),
      setConsumption: (vendorId, mode) => dispatch({ type: 'setConsumption', vendorId, mode }),
      setTakeaway: (vendorId, id) => dispatch({ type: 'setTakeaway', vendorId, id }),
      setWhen: (vendorId, when) => dispatch({ type: 'setWhen', vendorId, when }),
      setScheduleAt: (vendorId, value) => dispatch({ type: 'setScheduleAt', vendorId, value }),
      dropOrder: (vendorId) => dispatch({ type: 'dropOrder', vendorId }),
      clear: () => dispatch({ type: 'clear' }),
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart hors CartProvider');
  return ctx;
}
