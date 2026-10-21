import { useCallback, useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
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

  return (
    <div className="dashboard-body">
      <SubpageBar title="Historique" onBack={onBack} />
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

      <div className="section-tabs">
        {['Aujourd’hui', 'Hier'].map((label, i) => (
          <button
            key={label}
            type="button"
            className={`section-tab${day === i ? ' active' : ''}`}
            onClick={() => setDay(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list catalog-list--inset">
          {tab === 'withdrawals'
            ? withdrawals.filter((w) => dayOffset(w.createdAt) === day).slice(0, 20).map((w) => (
                <div key={w.id} className="catalog-card">
                  <div className="catalog-main">
                    <strong>{formatTickets(w.amount)}</strong>
                    <span>
                      {formatDateTime(w.createdAt)} · {w.operator} ·{' '}
                      {WITHDRAWAL_STATUS_LABEL[w.status] || w.status}
                    </span>
                  </div>
                </div>
              ))
            : null}

          {tab === 'txs'
            ? txs.filter((tx) => dayOffset(tx.createdAt) === day).slice(0, 20).map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  className="catalog-card"
                  onClick={async () => {
                    try {
                      setTxDetail(await transactionsApi.get(tx.id));
                    } catch (e) {
                      showSnack(e.message || 'Détail indisponible');
                    }
                  }}
                >
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
          {txDetail && tab === 'txs' ? (
            <div className="catalog-card">
              <div className="catalog-main">
                <strong>{txDisplayTitle(txDetail)}</strong>
                <span>
                  {formatTickets(txDetail.amount)}
                  {txPublicCode(txDetail) ? ` · Commande ${txPublicCode(txDetail)}` : ''}
                  {txDetail.createdAt ? ` · ${formatDateTime(txDetail.createdAt)}` : ''}
                </span>
              </div>
              <button type="button" className="link-mini" onClick={() => setTxDetail(null)}>
                Fermer
              </button>
            </div>
          ) : null}

          {tab === 'withdrawals' && !withdrawals.filter((w) => dayOffset(w.createdAt) === day).length ? (
            <div className="empty-block">
              <h3>Aucun retrait</h3>
              <p>Tes demandes de retrait apparaîtront ici.</p>
            </div>
          ) : null}
          {tab === 'txs' && !txs.filter((tx) => dayOffset(tx.createdAt) === day).length ? (
            <div className="empty-block">
              <h3>Aucun mouvement</h3>
              <p>Les ventes et retraits s’affichent ici.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
