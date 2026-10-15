import { useCallback, useEffect, useState } from 'react';
import SubpageBar from '../components/SubpageBar';
import { transactionsApi, withdrawalsApi } from '../lib/api';
import {
  TX_TYPE_LABEL,
  WITHDRAWAL_STATUS_LABEL,
  formatDateTime,
  formatTickets,
} from '../lib/format';

export default function HistoryPage({ onBack, showSnack }) {
  const [tab, setTab] = useState('withdrawals');
  const [withdrawals, setWithdrawals] = useState([]);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        withdrawalsApi.mine({ limit: 30 }),
        transactionsApi.list({ limit: 40 }),
      ]);
      setWithdrawals(w.data || []);
      setTxs(t.data || []);
    } catch (e) {
      showSnack(e.message || 'Historique indisponible');
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

      {loading ? (
        <div style={{ display: 'grid', placeItems: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="catalog-list">
          {tab === 'withdrawals'
            ? withdrawals.map((w) => (
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
            ? txs.map((tx) => (
                <div key={tx.id} className="catalog-card">
                  <div className="catalog-main">
                    <strong>{TX_TYPE_LABEL[tx.type] || tx.type}</strong>
                    <span>
                      {formatDateTime(tx.createdAt)}
                      {tx.description ? ` · ${tx.description}` : ''}
                    </span>
                  </div>
                  <div className="price-tag">{formatTickets(tx.amount)}</div>
                </div>
              ))
            : null}

          {tab === 'withdrawals' && !withdrawals.length ? (
            <div className="empty-block">
              <h3>Aucun retrait</h3>
              <p>Tes demandes de retrait apparaîtront ici.</p>
            </div>
          ) : null}
          {tab === 'txs' && !txs.length ? (
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
