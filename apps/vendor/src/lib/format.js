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

export function dayOffset(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const n = new Date();
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const other = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((start - other) / 86400000);
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CODE_RE = /^[A-Z]-\d{2}$/i;

export function txPublicCode(tx) {
  const code = String(
    tx?.orderNumber || tx?.relatedOrder?.orderNumber || tx?.reference || '',
  ).trim();
  return CODE_RE.test(code) ? code.toUpperCase() : '';
}

export function txDisplayTitle(tx) {
  const cleaned = String(tx?.description || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (cleaned && !UUID_RE.test(cleaned)) return cleaned;
  return TX_TYPE_LABEL[tx?.type] || 'Mouvement';
}

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
