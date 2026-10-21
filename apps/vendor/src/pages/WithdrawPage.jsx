import { useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { withdrawalsApi } from '../lib/api';
import { formatTickets } from '../lib/format';

const QUICK = [2000, 5000, 10000, 20000];

export default function WithdrawPage({ vendor, onBack, onDone, showSnack }) {
  const balance = Number(vendor?.balanceFcfa || 0);
  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('MIXX');
  const [preview, setPreview] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1) {
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
    if (!Number.isFinite(n) || n < 1) {
      showSnack('Montant invalide');
      return;
    }
    setBusy(true);
    try {
      const res = await withdrawalsApi.request(n, operator);
      showSnack(res.message || 'Demande de retrait enregistrée');
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
      <SubpageBar title="Retirer" onBack={onBack} />
      <div className="page-pad">
        <p className="muted" style={{ marginBottom: 14 }}>
          Solde : <strong>{formatTickets(balance)}</strong>
        </p>

        <div className="chips" style={{ marginBottom: 14 }}>
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

        <div className="vfield">
          <label>Montant à recevoir (FCFA)</label>
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 7))}
            placeholder="Ex. 10000"
          />
        </div>

        <div className="vfield">
          <label>Réseau Mobile Money</label>
          <div className="chips">
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

        {quoting ? (
          <p className="muted">Calcul des frais…</p>
        ) : recap ? (
          <div className="recap-box">
            <div>
              <span>Débit total</span>
              <strong>
                {formatTickets(recap.debitedFromBalance ?? recap.totalDebit ?? 0)}
              </strong>
            </div>
            <div>
              <span>Net à recevoir</span>
              <strong>
                {formatTickets(recap.payoutAmountToSend ?? recap.payoutAmount ?? amount)}
              </strong>
            </div>
            {(recap.lines || []).length ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {recap.lines.join(' · ')}
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="muted" style={{ margin: '14px 0' }}>
          Le transfert est effectué manuellement par l’équipe kabakaba sur le numéro
          de ton compte vendeur ({vendor?.phone || '—'}).
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
  );
}
