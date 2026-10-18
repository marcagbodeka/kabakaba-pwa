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

const STORAGE_PREFIX = 'kabakaba.student.cart.v1';
const LEGACY_KEY = 'kabakaba.student.cart';

const initial = {
  vendorId: null,
  vendorName: null,
  lines: [],
  consumptionMode: 'ON_SITE',
  takeawayOptionId: null,
};

function lineKey(item) {
  if (item.menuId) return `m:${item.menuId}`;
  return `c:${item.componentId}`;
}

function storageKey(userId) {
  return userId ? `${STORAGE_PREFIX}.${userId}` : STORAGE_PREFIX;
}

function normalizeStored(parsed) {
  if (!parsed || typeof parsed !== 'object') return initial;
  const lines = Array.isArray(parsed.lines)
    ? parsed.lines.filter((l) => l && (l.menuId || l.componentId))
    : [];
  if (!lines.length) return initial;
  return {
    vendorId: parsed.vendorId ?? lines[0]?.vendorId ?? null,
    vendorName: parsed.vendorName ?? lines[0]?.vendorName ?? null,
    lines,
    consumptionMode:
      parsed.consumptionMode === 'TAKEAWAY' ? 'TAKEAWAY' : 'ON_SITE',
    takeawayOptionId: parsed.takeawayOptionId ?? null,
  };
}

function loadCart(userId) {
  try {
    const raw =
      localStorage.getItem(storageKey(userId)) ||
      localStorage.getItem(STORAGE_PREFIX) ||
      localStorage.getItem(LEGACY_KEY);
    if (!raw) return initial;
    return normalizeStored(JSON.parse(raw));
  } catch {
    return initial;
  }
}

function saveCart(userId, state) {
  const key = storageKey(userId);
  if (!state.lines.length) {
    localStorage.removeItem(key);
    localStorage.removeItem(STORAGE_PREFIX);
    localStorage.removeItem(LEGACY_KEY);
    return;
  }
  localStorage.setItem(
    key,
    JSON.stringify({
      vendorId: state.vendorId,
      vendorName: state.vendorName,
      lines: state.lines,
      consumptionMode: state.consumptionMode,
      takeawayOptionId: state.takeawayOptionId,
    }),
  );
  if (userId) {
    localStorage.removeItem(STORAGE_PREFIX);
    localStorage.removeItem(LEGACY_KEY);
  }
}

function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return action.state;
    case 'add': {
      const item = action.item;
      if (state.vendorId && state.vendorId !== item.vendorId) {
        return {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          lines: [{ ...item, quantity: item.quantity || 1 }],
          consumptionMode: 'ON_SITE',
          takeawayOptionId: null,
        };
      }
      const key = lineKey(item);
      const existing = state.lines.find((l) => lineKey(l) === key);
      if (existing) {
        return {
          ...state,
          vendorId: item.vendorId,
          vendorName: item.vendorName || state.vendorName,
          lines: state.lines.map((l) =>
            lineKey(l) === key
              ? { ...l, quantity: l.quantity + (item.quantity || 1) }
              : l,
          ),
        };
      }
      return {
        ...state,
        vendorId: item.vendorId,
        vendorName: item.vendorName || state.vendorName,
        lines: [...state.lines, { ...item, quantity: item.quantity || 1 }],
      };
    }
    case 'setQty': {
      const lines = state.lines
        .map((l) =>
          lineKey(l) === action.key
            ? { ...l, quantity: action.quantity }
            : l,
        )
        .filter((l) => l.quantity > 0);
      if (!lines.length) {
        return { ...initial };
      }
      return { ...state, lines };
    }
    case 'setConsumption':
      return {
        ...state,
        consumptionMode: action.mode,
        takeawayOptionId:
          action.mode === 'TAKEAWAY' ? state.takeawayOptionId : null,
      };
    case 'setTakeaway':
      return { ...state, takeawayOptionId: action.id };
    case 'clear':
      return { ...initial };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const skipPersist = useRef(true);
  const [state, dispatch] = useReducer(reducer, initial, () =>
    loadCart(userId),
  );

  // Re-hydrate when user id arrives (me() is async after login).
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
    const itemCount = state.lines.reduce((s, l) => s + l.quantity, 0);
    const subtotal = state.lines.reduce(
      (s, l) => s + l.quantity * (l.unitPrice || 0),
      0,
    );
    return {
      ...state,
      itemCount,
      subtotal,
      add: (item) => dispatch({ type: 'add', item }),
      setQty: (key, quantity) => dispatch({ type: 'setQty', key, quantity }),
      setConsumption: (mode) => dispatch({ type: 'setConsumption', mode }),
      setTakeaway: (id) => dispatch({ type: 'setTakeaway', id }),
      clear: () => dispatch({ type: 'clear' }),
      lineKey,
    };
  }, [state]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart hors CartProvider');
  return ctx;
}
