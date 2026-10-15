import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { paymentsApi, transactionsApi } from '../lib/api';
import {
  PhoneFormatter,
  TX_CREDIT_TYPES,
  TX_TYPE_LABEL,
  formatTickets,
  formatTime,
} from '../lib/format';

const QUICK_AMOUNTS = [600, 1100, 2200, 5250];

export default function WalletPage({ showSnack }) {
  const { user, refreshMe } = useAuth();
  const balance = Number(user?.walletBalance ?? 0);

  const [txs, setTxs] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('FLOOZ');
  const [phone, setPhone] = useState(() =>
    user?.phone ? PhoneFormatter.formatDisplay(user.phone.replace(/^\+?228/, '')) : '',
  );
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);

  const loadTx = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await transactionsApi.list({ limit: 30 });
      setTxs(res.data || []);
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

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ width: 40 }} />
        <h1>Portefeuille</h1>
        <div style={{ width: 40 }} />
      </div>
      <div className="wallet-card">
        <label>Solde disponible</label>
        <strong>{formatTickets(balance)}</strong>
      </div>

      <div className="list-pad">
        <div className="kicker">Recharger</div>
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

        <div className="kicker" style={{ marginTop: 28 }}>
          Historique
        </div>
        <div className="section-title">Mouvements</div>

        {loadingTx ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 32 }}>
            <div className="spinner" />
          </div>
        ) : txs.length === 0 ? (
          <p className="muted">Aucun mouvement pour l’instant.</p>
        ) : (
          txs.map((tx) => {
            const credit = TX_CREDIT_TYPES.has(tx.type);
            const amt = Number(tx.amount ?? 0);
            return (
              <div key={tx.id} className="item-card">
                <div style={{ flex: 1 }}>
                  <h3>{TX_TYPE_LABEL[tx.type] || tx.type}</h3>
                  <p>
                    {formatTime(tx.createdAt)}
                    {tx.description ? ` · ${tx.description}` : ''}
                  </p>
                </div>
                <div
                  className="price"
                  style={{ color: credit ? 'var(--green)' : 'var(--text-primary)' }}
                >
                  {credit ? '+' : '−'}
                  {formatTickets(amt)}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
