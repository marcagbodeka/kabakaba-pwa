import VendorHeader from '../components/VendorHeader';
import { formatTickets } from '../lib/format';

export default function WalletPage({
  vendor,
  onCapacityTap,
  onNotificationTap,
  hasUnread,
  onWithdraw,
  onHistory,
}) {
  const balance = Number(vendor?.balanceFcfa || 0);
  const pending = Number(vendor?.pendingAmountTickets || 0);
  const pendingCount = Number(vendor?.pendingOrdersCount || 0);

  return (
    <div className="dashboard-body">
      <VendorHeader
        vendor={vendor}
        showNotification
        hasUnread={hasUnread}
        onNotificationTap={onNotificationTap}
        onCapacityTap={onCapacityTap}
      />
      <div className="wallet-card">
        <div className="wallet-label">Solde disponible</div>
        <div className="wallet-amount">{formatTickets(balance)}</div>
        <div className="wallet-pending">
          {pending > 0
            ? `${formatTickets(pending)} en attente · ${pendingCount} commande${pendingCount > 1 ? 's' : ''}`
            : 'Aucun montant en attente'}
        </div>
        <div className="wallet-actions">
          <button type="button" className="primary" onClick={onWithdraw}>
            Retirer
          </button>
          <button type="button" onClick={onHistory}>
            Historique
          </button>
        </div>
      </div>
      <div className="page-pad">
        <p className="muted">
          Les tickets d’une commande apparaissent en attente tant qu’elle n’est pas
          « Prête », puis sont crédités à ton solde disponible.
        </p>
      </div>
    </div>
  );
}
