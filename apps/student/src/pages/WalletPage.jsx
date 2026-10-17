import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentsApi, transactionsApi } from '../lib/api';
import {
  PhoneFormatter,
  TX_CREDIT_TYPES,
  TX_TYPE_LABEL,
  formatTicketCount,
  formatTickets,
  formatTime,
} from '../lib/format';

const QUICK_AMOUNTS = [600, 1100, 2200, 5250];

export default function WalletPage({ showSnack }) {
  const { user, refreshMe } = useAuth();
  const balance = Number(user?.walletBalance ?? 0);
  const rechargeRef = useRef(null);
  const historyRef = useRef(null);

  const [txs, setTxs] = useState([]);
  const [payments, setPayments] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loadingTx, setLoadingTx] = useState(true);

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('FLOOZ');
  const [phone, setPhone] = useState(() =>
    user?.phone ? PhoneFormatter.formatDisplay(user.phone.replace(/^\+?228/, '')) : '',
  );
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const loadTx = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await transactionsApi.list({ limit: 30 });
      setTxs(res.data || []);
      try {
        const pays = await paymentsApi.list({ limit: 20 });
        setPayments(pays.data || []);
      } catch {
        setPayments([]);
      }
    } catch (e) {
      showSnack?.(e.message || 'Historique indisponible');
    } finally {
      setLoadingTx(false);
    }
  }, [showSnack]);

  useEffect(() => {
    loadTx();
  }, [loadTx]);

  useEffect(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 600) {
      setQuote(null);
      return undefined;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      paymentsApi
        .preview(Math.floor(n))
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
  }, [amount]);

  const onPhoneChange = (raw) => {
    setPhone(PhoneFormatter.formatDisplay(PhoneFormatter.digitsOf(raw).slice(0, 8)));
  };

  const recharge = async () => {
    const amountFcfa = Math.floor(Number(amount));
    if (!Number.isFinite(amountFcfa) || amountFcfa < 600) {
      showSnack?.('Montant minimum : 600 FCFA');
      return;
    }
    if (!PhoneFormatter.isValidLocal(phone)) {
      showSnack?.('Numéro Mobile Money invalide');
      return;
    }
    setPaying(true);
    try {
      const intent = await paymentsApi.createIntent({ amountFcfa, operator });
      await paymentsApi.initiate(intent.id, PhoneFormatter.toE164(phone));
      showSnack?.('Paiement initié — valide sur ton téléphone');
      setAmount('');
      setQuote(null);
      await refreshMe();
      await loadTx();
    } catch (e) {
      showSnack?.(e.message || 'Recharge impossible');
    } finally {
      setPaying(false);
    }
  };

  const firstName = user?.firstName || 'Étudiant';

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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Solde tickets</span>
        </div>
        <div className="hero-balance-amount">{formatTicketCount(balance)} tickets</div>
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
          const incoming = txs
            .filter((tx) => TX_CREDIT_TYPES.has(tx.type) && String(tx.status).toUpperCase() === 'COMPLETED')
            .reduce((s, tx) => s + Number(tx.amount || 0), 0);
          const outgoing = txs
            .filter((tx) => !TX_CREDIT_TYPES.has(tx.type) && String(tx.status).toUpperCase() === 'COMPLETED')
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

        <div className="mode-row" style={{ marginBottom: 14 }}>
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              className={`mode-chip${Number(amount) === a ? ' active' : ''}`}
              onClick={() => setAmount(String(a))}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="field">
          <label>Montant (FCFA)</label>
          <div className="input-shell">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="Ex. 2200"
              inputMode="numeric"
            />
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
          <p className="muted">Calcul du barème…</p>
        ) : quote ? (
          <p className="muted" style={{ marginBottom: 12 }}>
            {(quote.summaryLines || []).join(' · ') ||
              `${formatTickets(quote.ticketsReceived)} crédités · frais ${quote.feeFcfa} FCFA`}
          </p>
        ) : null}

        <button
          type="button"
          className="btn-fill"
          disabled={paying || !amount || !PhoneFormatter.isValidLocal(phone)}
          onClick={recharge}
        >
          {paying ? 'Envoi…' : 'Recharger'}
        </button>

        <div ref={historyRef} className="section-row" style={{ marginTop: 28 }}>
          <div>
            <div className="kicker kicker--muted">Mouvements</div>
            <div className="section-title" style={{ marginBottom: 0 }}>
              Dernières transactions
            </div>
          </div>
        </div>

        {loadingTx ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : txs.length === 0 ? (
          <div className="empty-state">
            <h3>Aucun mouvement</h3>
            <p>Tes recharges et paiements de commandes apparaîtront ici.</p>
          </div>
        ) : (
          txs.map((tx) => {
            const credit = TX_CREDIT_TYPES.has(tx.type);
            const amt = Number(tx.amount ?? 0);
            return (
              <button
                key={tx.id}
                type="button"
                className="tx-card"
                onClick={async () => {
                  try {
                    setDetail(await transactionsApi.get(tx.id));
                  } catch (e) {
                    showSnack?.(e.message || 'Détail indisponible');
                  }
                }}
              >
                <span className={`tx-icon${credit ? ' in' : ' out'}`}>{credit ? '+' : '−'}</span>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <h3>{TX_TYPE_LABEL[tx.type] || tx.type}</h3>
                  <p>
                    {formatTime(tx.createdAt)}
                    {tx.description ? ` · ${tx.description}` : ''}
                  </p>
                </div>
                <div className="price" style={{ color: credit ? 'var(--green)' : 'var(--text-primary)' }}>
                  {credit ? '+' : '−'}
                  {formatTicketCount(amt)} tickets
                </div>
              </button>
            );
          })
        )}

        <div className="kicker" style={{ marginTop: 28 }}>
          Recharges
        </div>
        {payments.length === 0 ? (
          <p className="muted">Aucune recharge pour l’instant.</p>
        ) : (
          payments.map((payment) => (
            <button
              key={payment.id}
              type="button"
              className="item-card"
              onClick={async () => {
                try {
                  const full = await paymentsApi.get(payment.id);
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
              <div style={{ flex: 1, textAlign: 'left' }}>
                <h3>{payment.amountFcfa} FCFA</h3>
                <p>
                  {formatTime(payment.createdAt)} · {payment.status}
                </p>
              </div>
              <div className="price">{formatTickets(payment.ticketsReceived || 0)}</div>
            </button>
          ))
        )}
        {detail ? (
          <div className="item-card" style={{ marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              {detail.kind === 'payment' ? (
                <>
                  <h3>Recharge {detail.status}</h3>
                  <p>
                    {detail.amountFcfa} FCFA · {formatTickets(detail.ticketsReceived || 0)}
                  </p>
                </>
              ) : (
                <>
                  <h3>{TX_TYPE_LABEL[detail.type] || detail.type}</h3>
                  <p>
                    {formatTickets(detail.amount)}
                    {detail.description ? ` · ${detail.description}` : ''}
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
