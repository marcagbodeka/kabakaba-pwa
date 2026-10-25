import { PhoneFormatter } from './format';

/**
 * Saisie d'un numéro togolais : accepte un numéro collé avec indicatif
 * (+228…, 00228…) et limite à 8 chiffres nationaux. Retourne « 90 12 34 56 ».
 */
export function parsePhoneInput(raw) {
  const digits = /^\s*(\+|00)/.test(raw)
    ? PhoneFormatter.toNational(raw)
    : PhoneFormatter.digitsOf(raw).slice(0, PhoneFormatter.localDigits);
  return PhoneFormatter.formatDisplay(digits);
}
