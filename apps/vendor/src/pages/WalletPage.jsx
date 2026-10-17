import { useEffect, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { IconReceipt } from '../components/icons';
import { transactionsApi } from '../lib/api';
import {
  TX_CREDIT_TYPES,
  TX_TYPE_LABEL,
  formatDateTime,
  formatTickets,
} from '../lib/format';

function TxRow({ tx }) {
  const credit = TX_CREDIT_TYPES.has(tx.type);
  const title =
    (tx.description && String(tx.description).trim()) ||
    TX_TYPE_LABEL[tx.type] ||
    tx.type;
  const amount = Number(tx.amount ?? 0);
  return (
    <div className="wallet-tx-row">
      <span className={`wallet-tx-icon${credit ? ' in' : ' out'}`}>
        {credit ? '↓' : '↑'}
      </span>
      <div className="wallet-tx-body">
        <strong>{title}</strong>
        <span>
          {tx.reference || formatDateTime(tx.createdAt)}
        </span>
      </div>
      <div className={`wallet-tx-amount${credit ? ' in' : ''}`}>
        {credit ? '+' : '−'} {formatTickets(amount)}
      </div>
    </div>
  );
}

export default function WalletPage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  onWithdraw,
  onHistory,
  showSnack,
}) {
  const balance = Number(vendor?.balanceFcfa || 0);
  const pending = Number(vendor?.pendingAmountTickets || 0);
  const pendingCount = Number(vendor?.pendingOrdersCount || 0);
  const canWithdraw = vendor?.canWithdraw !== false && balance > 0;

  const [txs, setTxs] = useState([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTx(true);
      try {
        const res = await transactionsApi.list({ limit: 8 });
        if (!cancelled) setTxs(res.data || []);
      } catch (e) {
        if (!cancelled) {
          setTxs([]);
          showSnack?.(e.message || 'Historique indisponible');
        }
      } finally {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showSnack, vendor?.balanceFcfa]);

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />

      <div className="wallet-scroll">
        <div className="wallet-card">
          <div className="wallet-card-deco wallet-card-deco--a" aria-hidden />
          <div className="wallet-card-deco wallet-card-deco--b" aria-hidden />
          <div className="wallet-card-inner">
            <div className="wallet-label">Solde disponible</div>
            <div className="wallet-amount">{formatTickets(balance)}</div>
            <div className="wallet-pending">
              {pending > 0
                ? `${formatTickets(pending)} en attente · ${pendingCount} commande${pendingCount > 1 ? 's' : ''}`
                : 'Aucun montant en attente'}
            </div>
            <div className="wallet-actions">
              <button
                type="button"
                className="primary"
                disabled={!canWithdraw}
                onClick={onWithdraw}
              >
                Retirer
              </button>
              <button type="button" onClick={onHistory}>
                Historique
              </button>
            </div>
          </div>
        </div>

        <div className="wallet-section">
          <div className="section-label-row">
            <span>Mouvements récents</span>
            <span className="section-label-line" />
          </div>

          {loadingTx ? (
            <div className="wallet-tx-card wallet-tx-card--center">
              <div className="spinner" />
            </div>
          ) : txs.length === 0 ? (
            <div className="wallet-tx-card wallet-tx-card--empty">
              <div className="empty-nest">
                <div className="empty-nest-inner">
                  <IconReceipt size={24} />
                </div>
              </div>
              <h3>Aucune opération pour l&apos;instant</h3>
              <p>L&apos;historique de tes mouvements apparaîtra ici.</p>
            </div>
          ) : (
            <div className="wallet-tx-card">
              {txs.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>

        <p className="wallet-footnote">
          Les tickets d’une commande apparaissent en attente tant qu’elle n’est pas « Prête »,
          puis sont crédités à ton solde disponible.
        </p>
      </div>
    </div>
  );
}
