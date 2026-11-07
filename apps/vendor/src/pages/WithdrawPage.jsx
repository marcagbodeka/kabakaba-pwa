import { useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { withdrawalsApi } from '../lib/api';
import { formatTickets } from '../lib/format';

const QUICK = [500, 2000, 5000, 20000];
const MIN_WITHDRAWAL = 500;

export default function WithdrawPage({ vendor, onBack, onDone, showSnack }) {
  const balance = Number(vendor?.balanceFcfa || 0);
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('MIXX');
  const [preview, setPreview] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < MIN_WITHDRAWAL) {
      setPreview(null);
      return undefined;
    }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(() => {
      withdrawalsApi
        .preview(n, operator)
        .then((p) => {
          if (!cancelled) setPreview(p);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        })
        .finally(() => {
          if (!cancelled) setQuoting(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [amount, operator]);

  const submit = async () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < MIN_WITHDRAWAL) {
      showSnack('Le retrait minimum est de 500 FCFA');
      return;
    }
    setBusy(true);
    try {
      const res = await withdrawalsApi.request(n, operator);
      showSnack(res.message || 'Demande de retrait enregistrée', 'success');
      onDone?.();
      onBack();
    } catch (e) {
      showSnack(e.message || 'Retrait impossible');
    } finally {
      setBusy(false);
    }
  };

  const recap = preview;

  return (
    <div className="dashboard-body">
      <SubpageBar title="Retirer" eyebrow="Portefeuille" onBack={onBack} />
      <div className="sheet-body sheet-body--sub">
        <div className="sub-scroll">
          <div className="withdraw-balance">
            <span>Solde disponible</span>
            <strong>{formatTickets(balance)}</strong>
          </div>

          <div className="vfield">
            <label>Montant rapide</label>
            <div className="chips" style={{ marginBottom: 0 }}>
              {QUICK.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`chip${Number(amount) === a ? ' active' : ''}`}
                  onClick={() => setAmount(String(a))}
                >
                  {formatTickets(a)}
                </button>
              ))}
            </div>
          </div>

          <div className="vfield">
            <label>Montant à recevoir (FCFA)</label>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
              placeholder="Minimum 500"
            />
          </div>

          <div className="vfield">
            <label>Réseau Mobile Money</label>
            <div className="chips" style={{ marginBottom: 0 }}>
              {['MIXX', 'FLOOZ'].map((op) => (
                <button
                  key={op}
                  type="button"
                  className={`chip${operator === op ? ' active' : ''}`}
                  onClick={() => setOperator(op)}
                >
                  {op === 'MIXX' ? 'Mixx (Yas)' : 'Flooz (Moov)'}
                </button>
              ))}
            </div>
          </div>

          {amount && Number(amount) < MIN_WITHDRAWAL ? (
            <p className="muted">Le retrait commence à 500 FCFA, sans frais.</p>
          ) : quoting ? (
            <p className="muted">Calcul…</p>
          ) : recap ? (
            <div className="recap-box">
              <div>
                <span>Débit total</span>
                <strong>
                  {formatTickets(recap.debitedFromBalance ?? recap.totalDebit ?? 0)}
                </strong>
              </div>
              <div>
                <span>Envoyé sur le réseau</span>
                <strong>
                  {formatTickets(recap.payoutAmountToSend ?? recap.payoutAmount ?? amount)}
                </strong>
              </div>
              {(recap.lines || []).length ? (
                <p className="muted" style={{ marginTop: 4 }}>
                  {recap.lines.join(' · ')}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="muted" style={{ margin: '16px 0 8px' }}>
            Aucun frais jusqu’à 18 999 FCFA. À partir de 19 900, Kabakaba ajoute les
            frais de retrait espèces du réseau : ton solde n’est débité que du montant
            demandé. Le transfert part sur {vendor?.phone || 'ton numéro'}.
          </p>

          <button
            type="button"
            className="btn-action fill accent full"
            disabled={busy || !amount}
            onClick={submit}
          >
            {busy ? 'Envoi…' : 'Demander le retrait'}
          </button>
        </div>
      </div>
    </div>
  );
}
