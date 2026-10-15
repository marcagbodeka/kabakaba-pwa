import { createContext, useContext, useMemo, useReducer } from 'react';

const CartContext = createContext(null);

function lineKey(item) {
  if (item.menuId) return `m:${item.menuId}`;
  return `c:${item.componentId}`;
}

function reducer(state, action) {
  switch (action.type) {
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
        return {
          vendorId: null,
          vendorName: null,
          lines: [],
          consumptionMode: 'ON_SITE',
          takeawayOptionId: null,
        };
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
      return {
        vendorId: null,
        vendorName: null,
        lines: [],
        consumptionMode: 'ON_SITE',
        takeawayOptionId: null,
      };
    default:
      return state;
  }
}

const initial = {
  vendorId: null,
  vendorName: null,
  lines: [],
  consumptionMode: 'ON_SITE',
  takeawayOptionId: null,
};

export function CartProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);

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
