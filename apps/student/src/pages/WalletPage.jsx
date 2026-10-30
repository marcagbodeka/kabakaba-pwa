import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BalanceEye, useBalanceHidden } from '../components/BalanceEye';
import { useAuth } from '../context/AuthContext';
import { paymentsApi, transactionsApi } from '../lib/api';
import { readView, writeView } from '../lib/instantView';
import {
  PAYMENT_STATUS_LABEL,
  PhoneFormatter,
  TX_CREDIT_TYPES,
  TX_STATUS_LABEL,
  TX_TYPE_LABEL,
  formatTicketCount,
  formatTickets,
  formatTime,
} from '../lib/format';

/** Tickets souhaités (pas le montant payé). Frais ajoutés serveur. */
const QUICK_TICKETS = [500, 1000, 2000, 5000, 10000];
const MIN_TICKETS = 500;
const MAX_TICKETS = 10000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const MACHINE_CODE = /[A-Z][A-Z0-9]*_[A-Z0-9_]+/;

/** Jamais de code technique (BAD_PIN_CODE, etc.) dans un message étudiant. */
function readablePaymentFailure(payment) {
  const code = String(payment?.fedapayErrorCode || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (code.includes('PIN') || code.includes('SECRET')) {
    return 'Code secret incorrect. Réessaie avec le bon code.';
  }
  const reason = String(payment?.failureReason || '').trim();
  if (reason && !MACHINE_CODE.test(reason)) return reason;
  if (code === 'ACCOUNT_NOT_FOUND' || code === 'CUSTOMER_NOT_FOUND') {
    return 'Ce numéro n’a pas de compte Mobile Money pour cet opérateur.';
  }
  if (code.includes('INSUFFICIENT') || code.includes('BALANCE')) {
    return 'Solde Mobile Money insuffisant.';
  }
  if (code.includes('CANCEL')) return 'Paiement annulé sur le téléphone.';
  if (code.includes('TIMEOUT') || code.includes('EXPIRED')) {
    return 'Délai dépassé. Tu n’as pas validé la demande à temps.';
  }
  return 'Paiement refusé. Vérifie ton numéro et valide la demande sur ton téléphone.';
}
const CODE_RE = /^[A-Z]-\d{2}$/i;

function txCaption(item) {
  const code = String(item.orderNumber || '').trim();
  if (CODE_RE.test(code)) return `Commande ${code.toUpperCase()}`;
  const desc = String(item.description || '')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (desc && !UUID_RE.test(desc) && desc.length <= 42) return desc;
  return '';
}

export default function WalletPage({ showSnack }) {
  const { user, refreshMe } = useAuth();
  const balance = Number(user?.walletBalance ?? 0);
  const rechargeRef = useRef(null);
  const historyRef = useRef(null);

  const cachedWallet = readView('wallet');
  const [txs, setTxs] = useState(() => cachedWallet?.txs || []);
  const [payments, setPayments] = useState(() => cachedWallet?.payments || []);
  const [detail, setDetail] = useState(null);
  const [day, setDay] = useState(0);
  const [loadingTx, setLoadingTx] = useState(!cachedWallet);

  /** Tickets souhaités (ex. 500 → paie 600 avec frais 100). */
  const [ticketsWanted, setTicketsWanted] = useState('');
  const [operator, setOperator] = useState('FLOOZ');
  const [phone, setPhone] = useState(() =>
    user?.phone ? PhoneFormatter.formatDisplay(user.phone.replace(/^\+?228/, '')) : '',
  );
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  /** @type {[{ id: string, amountFcfa: number, ticketsReceived: number, status: string }|null, Function]} */
  const [pendingPay, setPendingPay] = useState(null);
  const pollRef = useRef(null);
  const pollStartedRef = useRef(null);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const loadTx = useCallback(async () => {
    if (!readView('wallet')) setLoadingTx(true);
    let nextTxs = readView('wallet')?.txs || [];
    let nextPays = readView('wallet')?.payments || [];
    try {
      const res = await transactionsApi.list({ limit: 30 });
      nextTxs = res.data || [];
      setTxs(nextTxs);
      try {
        const pays = await paymentsApi.list({ limit: 20 });
        nextPays = pays.data || [];
        setPayments(nextPays);
      } catch {
        if (!readView('wallet')) setPayments([]);
      }
      writeView('wallet', { txs: nextTxs, payments: nextPays });
    } catch (e) {
      if (!readView('wallet')) showSnack?.(e.message || 'Historique indisponible');
    } finally {
      setLoadingTx(false);
    }
  }, [showSnack]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollStartedRef.current = null;
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  const startPoll = useCallback(
    (paymentId, meta) => {
      stopPoll();
      setPendingPay({ id: paymentId, status: 'PENDING', ...meta });
      pollStartedRef.current = Date.now();
      const tick = async () => {
        try {
          const payment = await paymentsApi.get(paymentId);
          const status = String(payment?.status || '').toUpperCase();
          const failureText =
            status === 'FAILED' ? readablePaymentFailure(payment) : '';
          setPendingPay((prev) =>
            prev?.id === paymentId
              ? {
                  ...prev,
                  status,
                  failureText,
                  ticketsReceived: Number(
                    payment.ticketsReceived ?? prev.ticketsReceived ?? 0,
                  ),
                }
              : prev,
          );
          if (status === 'SUCCESS' || status === 'FAILED') {
            stopPoll();
            await refreshMe();
            await loadTx();
            if (status === 'SUCCESS') {
              showSnack?.('Recharge réussie — tickets crédités', 'success');
            } else {
              showSnack?.(failureText);
            }
            return;
          }
          if (
            pollStartedRef.current &&
            Date.now() - pollStartedRef.current > 180_000
          ) {
            stopPoll();
            showSnack?.(
              'Toujours en attente. Valide la demande sur ton téléphone, ou réessaie plus tard.',
            );
          }
        } catch {
          /* ignore transient poll errors */
        }
      };
      // Laisse le temps au push USSD d’arriver avant le 1er sync.
      setTimeout(tick, 2500);
      pollRef.current = setInterval(tick, 5000);
    },
    [loadTx, refreshMe, showSnack, stopPoll],
  );

  useEffect(() => {
    loadTx();
  }, [loadTx]);

  /** Historique unifié : mouvements wallet + recharges (dont PENDING). */
  const history = useMemo(() => {
    const items = [];
    for (const tx of txs) {
      items.push({
        kind: 'tx',
        id: `tx-${tx.id}`,
        rawId: tx.id,
        createdAt: tx.createdAt,
        type: tx.type,
        status: String(tx.status || 'COMPLETED').toUpperCase(),
        amount: Number(tx.amount ?? 0),
        description: tx.description,
        orderNumber:
          tx.orderNumber ||
          tx.relatedOrder?.orderNumber ||
          (/^[A-Z]-\d{2}$/i.test(String(tx.reference || '')) ? tx.reference : ''),
        credit: TX_CREDIT_TYPES.has(tx.type),
      });
    }
    for (const payment of payments) {
      const status = String(payment.status || '').toUpperCase();
      // SUCCESS déjà reflété en DEPOSIT côté /transactions — on garde PENDING/FAILED.
      if (status === 'SUCCESS') continue;
      items.push({
        kind: 'payment',
        id: `pay-${payment.id}`,
        rawId: payment.id,
        createdAt: payment.createdAt,
        status,
        amountFcfa: Number(payment.amountFcfa ?? 0),
        ticketsReceived: Number(payment.ticketsReceived ?? 0),
        credit: true,
      });
    }
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return items;
  }, [txs, payments]);

  const dayItems = useMemo(() => {
    const target = new Date();
    if (day === 1) target.setDate(target.getDate() - 1);
    return history
      .filter((item) => {
        const d = new Date(item.createdAt);
        return (
          d.getFullYear() === target.getFullYear() &&
          d.getMonth() === target.getMonth() &&
          d.getDate() === target.getDate()
        );
      })
      .slice(0, 20);
  }, [history, day]);

  useEffect(() => {
    const n = Number(ticketsWanted);
    if (!Number.isFinite(n) || n < MIN_TICKETS || n > MAX_TICKETS) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      paymentsApi
        .preview({ ticketsDesired: Math.floor(n) })
        .then((q) => {
          if (!cancelled) setQuote(q);
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [ticketsWanted]);

  const onPhoneChange = (raw) => {
    setPhone(PhoneFormatter.formatDisplay(PhoneFormatter.digitsOf(raw).slice(0, 8)));
  };

  const recharge = async () => {
    const tickets = Math.floor(Number(ticketsWanted));
    if (!Number.isFinite(tickets) || tickets < MIN_TICKETS) {
      showSnack?.(`Minimum : ${formatTicketCount(MIN_TICKETS)} tickets`);
      return;
    }
    if (tickets > MAX_TICKETS) {
      showSnack?.(`Maximum : ${formatTicketCount(MAX_TICKETS)} tickets`);
      return;
    }
    if (!quote) {
      showSnack?.('Attends le calcul des frais');
      return;
    }
    if (!PhoneFormatter.isValidLocal(phone)) {
      showSnack?.('Numéro Mobile Money invalide');
      return;
    }
    setPaying(true);
    try {
      const intent = await paymentsApi.createIntent({
        ticketsReceived: tickets,
        operator,
      });
      const mmPhone = PhoneFormatter.toE164(phone);
      await paymentsApi.initiate(intent.id, mmPhone);
      setTicketsWanted('');
      setQuote(null);
      showSnack?.('Paiement initié — valide sur ton téléphone');

      startPoll(intent.id, {
        amountFcfa: intent.amountFcfa || quote.amountFcfa,
        ticketsReceived: intent.ticketsReceived || tickets,
        operator,
      });
      await loadTx();
    } catch (e) {
      showSnack?.(e.message || 'Recharge impossible');
    } finally {
      setPaying(false);
    }
  };

  const firstName = user?.firstName || 'Étudiant';
  const { hidden: balanceHidden, toggle: toggleBalance } = useBalanceHidden();

  return (
    <div className="page page--flush">
      <div className="hero hero--wallet">
        <div className="hero-top">
          <div>
            <div className="hero-greet" style={{ fontSize: 11, letterSpacing: '0.03em' }}>
              Mon portefeuille
            </div>
            <div className="hero-name" style={{ fontSize: 17 }}>
              Bonjour, {firstName}
            </div>
          </div>
          <button
            type="button"
            className="hero-icon-btn"
            aria-label="Historique"
            onClick={() => scrollTo(historyRef)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
              <path d="M12 7v5l3 2" />
            </svg>
          </button>
        </div>
        <div className="hero-balance-row">
          <BalanceEye hidden={balanceHidden} onToggle={toggleBalance} />
          <span>Solde tickets</span>
        </div>
        <div className="hero-balance-amount">
          {balanceHidden ? '••••' : `${formatTicketCount(balance)} tickets`}
        </div>
        <div className="hero-pills hero-pills--3">
          <button type="button" className="hero-pill hero-pill--primary" onClick={() => scrollTo(rechargeRef)}>
            Recharger
          </button>
          <button
            type="button"
            className="hero-pill"
            onClick={() => showSnack?.('Envoi de tickets bientôt disponible')}
          >
            Envoyer
          </button>
          <button type="button" className="hero-pill" onClick={() => scrollTo(historyRef)}>
            Historique
          </button>
        </div>
      </div>

      <div className="sheet-body">
        {(() => {
          const dayTx = dayItems.filter((item) => item.kind === 'tx');
          const incoming = dayTx
            .filter((tx) => tx.credit && tx.status === 'COMPLETED')
            .reduce((s, tx) => s + Number(tx.amount || 0), 0);
          const outgoing = dayTx
            .filter((tx) => !tx.credit && tx.status === 'COMPLETED')
            .reduce((s, tx) => s + Number(tx.amount || 0), 0);
          return (
            <div className="wallet-stats">
              <div className="wallet-stat">
                <span className="wallet-stat-icon in">↓</span>
                <div>
                  <label>Entrées</label>
                  <strong>+{formatTicketCount(incoming)}</strong>
                </div>
              </div>
              <div className="wallet-stat">
                <span className="wallet-stat-icon out">↑</span>
                <div>
                  <label>Sorties</label>
                  <strong>-{formatTicketCount(outgoing)}</strong>
                </div>
              </div>
            </div>
          );
        })()}

        <div ref={rechargeRef} className="kicker kicker--muted">
          Recharger
        </div>
        <div className="section-title">Mobile Money</div>

        {pendingPay ? (
          <div className={`recharge-status recharge-status--${String(pendingPay.status).toLowerCase()}`}>
            <div className="recharge-status-icon" aria-hidden>
              {pendingPay.status === 'SUCCESS' ? '✓' : pendingPay.status === 'FAILED' ? '!' : '…'}
            </div>
            <div className="recharge-status-body">
              <strong>
                {pendingPay.status === 'SUCCESS'
                  ? 'Recharge réussie'
                  : pendingPay.status === 'FAILED'
                    ? 'Paiement échoué'
                    : 'Valide sur ton téléphone'}
              </strong>
              <span>
                {pendingPay.status === 'SUCCESS'
                  ? `${formatTicketCount(pendingPay.ticketsReceived)} tickets crédités`
                  : pendingPay.status === 'FAILED'
                    ? pendingPay.failureText ||
                      'Le paiement a été refusé. Tu peux réessayer.'
                    : `Confirme ${pendingPay.operator || 'Mobile Money'} · ${pendingPay.amountFcfa || '—'} FCFA`}
              </span>
            </div>
            {pendingPay.status !== 'PENDING' ? (
              <button type="button" className="link-accent" onClick={() => setPendingPay(null)}>
                OK
              </button>
            ) : (
              <div className="spinner spinner--sm" />
            )}
          </div>
        ) : null}

        <p className="recharge-hint">Tickets à recevoir. Les frais s’ajoutent au paiement.</p>

        <div className="mode-row mode-row--tickets" style={{ marginBottom: 14 }}>
          {QUICK_TICKETS.map((t) => (
            <button
              key={t}
              type="button"
              className={`mode-chip mode-chip--tickets${Number(ticketsWanted) === t ? ' active' : ''}`}
              onClick={() => setTicketsWanted(String(t))}
            >
              <strong>{formatTicketCount(t)}</strong>
              <span>tickets</span>
            </button>
          ))}
        </div>

        <div className="field">
          <label>Nombre de tickets</label>
          <div className="input-shell">
            <input
              value={ticketsWanted}
              onChange={(e) =>
                setTicketsWanted(e.target.value.replace(/\D/g, '').slice(0, 5))
              }
              placeholder="Entrez le montant des tickets"
              inputMode="numeric"
            />
            <span className="suffix">tickets</span>
          </div>
        </div>

        <div className="field">
          <label>Opérateur</label>
          <div className="mode-row">
            {['FLOOZ', 'MIXX'].map((op) => (
              <button
                key={op}
                type="button"
                className={`mode-chip${operator === op ? ' active' : ''}`}
                onClick={() => setOperator(op)}
              >
                {op === 'FLOOZ' ? 'Flooz' : 'Mixx'}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Numéro Mobile Money</label>
          <div className="input-shell">
            <span className="prefix">+228</span>
            <input
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="90 12 34 56"
              inputMode="numeric"
            />
          </div>
        </div>

        {quoting ? (
          <div className="recharge-recap recharge-recap--muted">Calcul des frais…</div>
        ) : quote ? (
          <div className="recharge-recap recharge-recap--breakdown">
            <div className="recharge-recap-row">
              <span>Tickets crédités</span>
              <strong>{formatTicketCount(quote.ticketsReceived)}</strong>
            </div>
            <div className="recharge-recap-row">
              <span>Frais de service</span>
              <strong>{formatTickets(quote.feeFcfa)}</strong>
            </div>
            <div className="recharge-recap-row recharge-recap-row--total">
              <span>Tu paies</span>
              <strong>{formatTickets(quote.amountFcfa)}</strong>
            </div>
          </div>
        ) : ticketsWanted && Number(ticketsWanted) > 0 ? (
          <div className="recharge-recap recharge-recap--muted">
            Entre {formatTicketCount(MIN_TICKETS)} et {formatTicketCount(MAX_TICKETS)} tickets
          </div>
        ) : null}

        <button
          type="button"
          className="btn-fill"
          disabled={
            paying || !quote || !PhoneFormatter.isValidLocal(phone)
          }
          onClick={recharge}
        >
          {paying
            ? 'Envoi…'
            : quote
              ? `Recharger ${formatTicketCount(quote.ticketsReceived)} tickets`
              : 'Recharger'}
        </button>

        <div ref={historyRef} className="section-row" style={{ marginTop: 28 }}>
          <div>
            <div className="kicker kicker--muted">Mouvements</div>
            <div className="section-title" style={{ marginBottom: 0 }}>
              {day === 0 ? 'Aujourd’hui' : 'Hier'}
            </div>
          </div>
        </div>

        <div className="light-tabs" style={{ marginBottom: 12 }}>
          {['Aujourd’hui', 'Hier'].map((label, i) => (
            <button
              key={label}
              type="button"
              className={`light-tab${day === i ? ' active' : ''}`}
              onClick={() => setDay(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {loadingTx ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : dayItems.length === 0 ? (
          <div className="empty-state">
            <h3>{day === 0 ? 'Rien aujourd’hui' : 'Rien hier'}</h3>
            <p>Les mouvements plus anciens ne s’affichent plus. 20 maximum par jour.</p>
          </div>
        ) : (
          dayItems.map((item) => {
            if (item.kind === 'payment') {
              const statusLabel =
                PAYMENT_STATUS_LABEL[item.status] || item.status;
              const statusMod = item.status.toLowerCase();
              return (
                <button
                  key={item.id}
                  type="button"
                  className="tx-card"
                  onClick={async () => {
                    try {
                      const full = await paymentsApi.get(item.rawId);
                      setDetail({
                        kind: 'payment',
                        amountFcfa: full.amountFcfa,
                        ticketsReceived: full.ticketsReceived,
                        status: full.status,
                        createdAt: full.createdAt,
                      });
                    } catch (e) {
                      showSnack?.(e.message || 'Recharge indisponible');
                    }
                  }}
                >
                  <span className="tx-icon in">+</span>
                  <div className="tx-card-body">
                    <h3>
                      Recharge · {formatTicketCount(item.ticketsReceived)}{' '}
                      tickets
                    </h3>
                    <p>
                      {formatTime(item.createdAt)}
                      <span className={`tx-status tx-status--${statusMod}`}>
                        {statusLabel}
                      </span>
                    </p>
                  </div>
                  <div className="price" style={{ color: 'var(--green)' }}>
                    +{formatTicketCount(item.ticketsReceived)}
                  </div>
                </button>
              );
            }

            const statusLabel = TX_STATUS_LABEL[item.status] || item.status;
            const statusMod = item.status.toLowerCase();
            return (
              <button
                key={item.id}
                type="button"
                className="tx-card"
                onClick={async () => {
                  try {
                    setDetail(await transactionsApi.get(item.rawId));
                  } catch (e) {
                    showSnack?.(e.message || 'Détail indisponible');
                  }
                }}
              >
                <span className={`tx-icon${item.credit ? ' in' : ' out'}`}>
                  {item.credit ? '+' : '−'}
                </span>
                <div className="tx-card-body">
                  <h3>{TX_TYPE_LABEL[item.type] || item.type}</h3>
                  <p>
                    {formatTime(item.createdAt)}
                    {txCaption(item) ? ` · ${txCaption(item)}` : ''}
                    <span className={`tx-status tx-status--${statusMod}`}>
                      {statusLabel}
                    </span>
                  </p>
                </div>
                <div
                  className="price"
                  style={{
                    color: item.credit ? 'var(--green)' : 'var(--text-primary)',
                  }}
                >
                  {item.credit ? '+' : '−'}
                  {formatTicketCount(item.amount)} tickets
                </div>
              </button>
            );
          })
        )}
        {detail ? (
          <div className="tx-card tx-card--detail" style={{ marginTop: 12 }}>
            <div className="tx-card-body">
              {detail.kind === 'payment' ? (
                <>
                  <h3>
                    Recharge ·{' '}
                    {PAYMENT_STATUS_LABEL[String(detail.status).toUpperCase()] ||
                      detail.status}
                  </h3>
                  <p>
                    {detail.amountFcfa} FCFA ·{' '}
                    {formatTicketCount(detail.ticketsReceived || 0)} tickets
                  </p>
                </>
              ) : (
                <>
                  <h3>{TX_TYPE_LABEL[detail.type] || detail.type}</h3>
                  <p>
                    {formatTicketCount(detail.amount)} tickets
                    {detail.status
                      ? ` · ${TX_STATUS_LABEL[String(detail.status).toUpperCase()] || detail.status}`
                      : ''}
                    {txCaption(detail) ? ` · ${txCaption(detail)}` : ''}
                  </p>
                </>
              )}
              <button type="button" className="link-accent" onClick={() => setDetail(null)}>
                Fermer
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
