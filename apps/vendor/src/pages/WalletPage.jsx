import { useEffect, useState } from 'react';
import VendorHeader from '../components/VendorHeader';
import { IconReceipt } from '../components/icons';
import { transactionsApi } from '../lib/api';
import { readView, writeView } from '../lib/instantView';
import {
  TX_CREDIT_TYPES,
  dayOffset,
  formatDateTime,
  formatTickets,
  txDisplayTitle,
  txPublicCode,
} from '../lib/format';

function TxRow({ tx }) {
  const credit = TX_CREDIT_TYPES.has(tx.type);
  const title = txDisplayTitle(tx);
  const code = txPublicCode(tx);
  const amount = Number(tx.amount ?? 0);
  return (
    <div className="wallet-tx-row">
      <span className={`wallet-tx-icon${credit ? ' in' : ' out'}`}>
        {credit ? '↓' : '↑'}
      </span>
      <div className="wallet-tx-body">
        <strong>{title}</strong>
        <span>{code ? `Commande ${code}` : formatDateTime(tx.createdAt)}</span>
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

  const [txs, setTxs] = useState(() => readView('wallet-tx') || []);
  const [loadingTx, setLoadingTx] = useState(() => !readView('wallet-tx'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!readView('wallet-tx')) setLoadingTx(true);
      try {
        const res = await transactionsApi.list({ limit: 8 });
        const rows = res.data || [];
        if (!cancelled) {
          setTxs(rows);
          writeView('wallet-tx', rows);
        }
      } catch (e) {
        if (!cancelled && !readView('wallet-tx')) {
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
        eyebrow="Portefeuille"
      />

      <div className="sheet-body">
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
              <span>Aujourd’hui</span>
              <span className="section-label-line" />
            </div>

            {loadingTx ? (
              <div className="skeleton-stack">
                <div className="skeleton-card" style={{ height: 72 }} />
                <div className="skeleton-card" style={{ height: 72 }} />
              </div>
            ) : txs.filter((tx) => dayOffset(tx.createdAt) === 0).length === 0 ? (
              <div className="wallet-tx-card wallet-tx-card--empty">
                <div className="empty-nest">
                  <div className="empty-nest-inner">
                    <IconReceipt size={24} />
                  </div>
                </div>
                <h3>Rien aujourd’hui</h3>
                <p>Les mouvements d’aujourd’hui apparaissent ici. Hier est dans l’historique.</p>
              </div>
            ) : (
              <div className="wallet-tx-card">
                {txs
                  .filter((tx) => dayOffset(tx.createdAt) === 0)
                  .slice(0, 6)
                  .map((tx) => (
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
    </div>
  );
}
