import { useCallback, useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { IconReceipt, IconWallet } from '../components/icons';
import { transactionsApi, withdrawalsApi } from '../lib/api';
import {
  WITHDRAWAL_STATUS_LABEL,
  dayOffset,
  formatDateTime,
  formatTickets,
  txDisplayTitle,
  txPublicCode,
} from '../lib/format';
import { readView, writeView } from '../lib/instantView';

function statusTone(status) {
  if (status === 'COMPLETED') return 'ok';
  if (status === 'FAILED' || status === 'CANCELLED') return 'bad';
  return 'wait';
}

export default function HistoryPage({ onBack, showSnack }) {
  const [tab, setTab] = useState('withdrawals');
  const [day, setDay] = useState(0);
  const cachedHistory = readView('history');
  const [withdrawals, setWithdrawals] = useState(() => cachedHistory?.withdrawals || []);
  const [txs, setTxs] = useState(() => cachedHistory?.txs || []);
  const [txDetail, setTxDetail] = useState(null);
  const [loading, setLoading] = useState(!cachedHistory);

  const load = useCallback(async () => {
    if (!readView('history')) setLoading(true);
    try {
      const [w, t] = await Promise.all([
        withdrawalsApi.mine({ limit: 30 }),
        transactionsApi.list({ limit: 40 }),
      ]);
      const next = { withdrawals: w.data || [], txs: t.data || [] };
      setWithdrawals(next.withdrawals);
      setTxs(next.txs);
      writeView('history', next);
    } catch (e) {
      if (!readView('history')) showSnack(e.message || 'Historique indisponible');
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => {
    load();
  }, [load]);

  const dayRows =
    tab === 'withdrawals'
      ? withdrawals.filter((w) => dayOffset(w.createdAt) === day).slice(0, 20)
      : txs.filter((tx) => dayOffset(tx.createdAt) === day).slice(0, 20);

  return (
    <div className="dashboard-body">
      <SubpageBar title="Historique" eyebrow="Portefeuille" onBack={onBack} />
      <div className="sheet-body sheet-body--sub">
        <div className="sub-toolbar">
          <div className="section-tabs">
            <button
              type="button"
              className={`section-tab${tab === 'withdrawals' ? ' active' : ''}`}
              onClick={() => setTab('withdrawals')}
            >
              Retraits
            </button>
            <button
              type="button"
              className={`section-tab${tab === 'txs' ? ' active' : ''}`}
              onClick={() => setTab('txs')}
            >
              Mouvements
            </button>
          </div>
          <div className="day-pills">
            {['Aujourd’hui', 'Hier'].map((label, i) => (
              <button
                key={label}
                type="button"
                className={`day-pill${day === i ? ' on' : ''}`}
                onClick={() => setDay(i)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="sub-scroll catalog-list">
            {tab === 'withdrawals'
              ? dayRows.map((w) => (
                  <div key={w.id} className="ledger-row">
                    <span className="ledger-mark out" aria-hidden>
                      ↑
                    </span>
                    <div className="catalog-main">
                      <strong>{formatTickets(w.amount)}</strong>
                      <span>
                        {formatDateTime(w.createdAt)} · {w.operator}
                      </span>
                    </div>
                    <span className={`tone tone--${statusTone(w.status)}`}>
                      {WITHDRAWAL_STATUS_LABEL[w.status] || w.status}
                    </span>
                  </div>
                ))
              : null}

            {tab === 'txs'
              ? dayRows.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    className="ledger-row"
                    onClick={async () => {
                      try {
                        setTxDetail(await transactionsApi.get(tx.id));
                      } catch (e) {
                        showSnack(e.message || 'Détail indisponible');
                      }
                    }}
                  >
                    <span className="ledger-mark in" aria-hidden>
                      ↓
                    </span>
                    <div className="catalog-main">
                      <strong>{txDisplayTitle(tx)}</strong>
                      <span>
                        {formatDateTime(tx.createdAt)}
                        {txPublicCode(tx) ? ` · Commande ${txPublicCode(tx)}` : ''}
                      </span>
                    </div>
                    <div className="price-tag">{formatTickets(tx.amount)}</div>
                  </button>
                ))
              : null}

            {!dayRows.length ? (
              <div className="empty-block">
                <div className="empty-nest">
                  <div className="empty-nest-inner">
                    {tab === 'withdrawals' ? <IconWallet size={22} /> : <IconReceipt size={22} />}
                  </div>
                </div>
                <h3>{tab === 'withdrawals' ? 'Aucun retrait' : 'Aucun mouvement'}</h3>
                <p>
                  {tab === 'withdrawals'
                    ? 'Tes demandes de retrait apparaîtront ici.'
                    : 'Les ventes et retraits s’affichent ici.'}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {txDetail ? (
        <div className="sheet-backdrop" onClick={() => setTxDetail(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <h2>{txDisplayTitle(txDetail)}</h2>
            <p className="sub">
              {formatTickets(txDetail.amount)}
              {txPublicCode(txDetail) ? ` · Commande ${txPublicCode(txDetail)}` : ''}
              {txDetail.createdAt ? ` · ${formatDateTime(txDetail.createdAt)}` : ''}
            </p>
            <button type="button" className="btn-action fill primary full" onClick={() => setTxDetail(null)}>
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
