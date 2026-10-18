export function formatTicketCount(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n);
}

export function formatTickets(amount, currency = 'FCFA') {
  return `${formatTicketCount(amount)} ${currency}`;
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  /** 8 chiffres nationaux (sans 228). */
  toNational(value) {
    let digits = this.digitsOf(value);
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('228')) digits = digits.slice(3);
    return digits.slice(0, this.localDigits);
  },
  /**
   * Format d’envoi initiate selon l’opérateur :
   * - FLOOZ (Moov) → +228XXXXXXXX
   * - MIXX (Yas)   → XXXXXXXX (sans 228) — exigence FedaPay togocel
   */
  toMobileMoney(value, operator) {
    if (String(operator).toUpperCase() === 'MIXX') {
      return this.toNational(value);
    }
    return this.toE164(value);
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

export const UNIT_LABEL = {
  PORTION: 'portion',
  UNIT: 'unité',
  PIECE: 'pièce',
  BOTTLE: 'bouteille',
  SACHET: 'sachet',
};

export const TX_TYPE_LABEL = {
  DEPOSIT: 'Rechargement',
  PAYMENT: 'Commande',
  SALE: 'Vente',
  REFUND: 'Remboursement',
  WITHDRAWAL: 'Retrait',
  REFERRAL_BONUS: 'Bonus parrainage',
};

/** Types qui créditent le portefeuille étudiant. */
export const TX_CREDIT_TYPES = new Set(['DEPOSIT', 'REFUND', 'REFERRAL_BONUS']);

export const PAYMENT_STATUS_LABEL = {
  PENDING: 'En attente',
  SUCCESS: 'Réussi',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};

export const TX_STATUS_LABEL = {
  COMPLETED: 'Terminé',
  PENDING: 'En attente',
  FAILED: 'Échoué',
  CANCELLED: 'Annulé',
};
