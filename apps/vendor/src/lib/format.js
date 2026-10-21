export function formatTickets(amount, currency = 'FCFA') {
  const n = Number(amount) || 0;
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n)} ${currency}`;
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCountdown(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export const PhoneFormatter = {
  localDigits: 8,
  digitsOf(value) {
    return String(value || '').replace(/\D/g, '');
  },
  formatDisplay(value) {
    const digits = this.digitsOf(value);
    const groups = [];
    for (let i = 0; i < digits.length; i += 2) {
      groups.push(digits.slice(i, i + 2));
    }
    return groups.join(' ');
  },
  isValidLocal(value) {
    return this.digitsOf(value).length === this.localDigits;
  },
  toE164(value) {
    let digits = this.digitsOf(value);
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('228')) return `+${digits}`;
    return `+228${digits}`;
  },
};

export function initialsFrom(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '··';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export const ORDER_STATUS_LABEL = {
  CONFIRMED: 'Confirmée',
  IN_PREPARATION: 'En préparation',
  READY: 'Prête',
  RECEIVED: 'Récupérée',
  CANCELLED: 'Annulée',
};

export const CAPACITY_LABEL = {
  OPEN: 'Ouverte',
  BUSY: 'Occupée',
  CLOSED: 'Fermée',
};

export function consumptionLabel(order) {
  if (order.consumptionMode === 'TAKEAWAY') {
    return order.takeawayOption?.name || 'À emporter';
  }
  return 'Sur place';
}

export const UNIT_LABEL = {
  PORTION: 'portion',
  UNIT: 'unité',
  PIECE: 'pièce',
  BOTTLE: 'bouteille',
  SACHET: 'sachet',
};

export const UNIT_OPTIONS = [
  { value: 'PORTION', label: 'Portion' },
  { value: 'UNIT', label: 'Unité' },
  { value: 'PIECE', label: 'Pièce' },
  { value: 'BOTTLE', label: 'Bouteille' },
  { value: 'SACHET', label: 'Sachet' },
];

export const TX_TYPE_LABEL = {
  DEPOSIT: 'Recharge',
  PAYMENT: 'Paiement',
  SALE: 'Vente',
  REFUND: 'Remboursement',
  WITHDRAWAL: 'Retrait',
  REFERRAL_BONUS: 'Bonus de parrainage',
};

/** Mouvements qui créditent le solde vendeur. */
export const TX_CREDIT_TYPES = new Set([
  'SALE',
  'DEPOSIT',
  'REFUND',
  'REFERRAL_BONUS',
]);

export function orderDisplayCode(order) {
  const code = String(order?.orderNumber || order?.activeOrderNumber || '').trim();
  if (/^[A-Z]-\d{2}$/i.test(code)) return code.toUpperCase();
  return '—';
}

export const WITHDRAWAL_STATUS_LABEL = {
  PENDING: 'En attente',
  PROCESSING: 'En cours',
  COMPLETED: 'Payé',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};
