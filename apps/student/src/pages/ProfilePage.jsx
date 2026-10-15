import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { campusApi, referralsApi } from '../lib/api';
import { PhoneFormatter, formatTickets } from '../lib/format';

export default function ProfilePage({ showSnack }) {
  const { user, logout } = useAuth();
  const [campusName, setCampusName] = useState('');
  const [referral, setReferral] = useState(null);

  const phone = user?.phone
    ? `+228 ${PhoneFormatter.formatDisplay(user.phone.replace(/^\+?228/, ''))}`
    : '—';

  useEffect(() => {
    if (!user?.campusId) {
      setCampusName('');
      return;
    }
    campusApi
      .get(user.campusId)
      .then((c) => setCampusName(c?.name || ''))
      .catch(() => setCampusName(''));
  }, [user?.campusId]);

  useEffect(() => {
    referralsApi
      .me()
      .then(setReferral)
      .catch(() => setReferral(null));
  }, []);

  const copyCode = async () => {
    const code = referral?.referralCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showSnack?.('Code copié');
    } catch {
      showSnack?.(code);
    }
  };

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ width: 40 }} />
        <h1>Profil</h1>
        <div style={{ width: 40 }} />
      </div>
      <div className="list-pad">
        <div className="item-card">
          <div style={{ flex: 1 }}>
            <h3>
              {user?.firstName || ''} {user?.lastName || ''}
            </h3>
            <p>{phone}</p>
            {campusName ? <p>{campusName}</p> : null}
          </div>
        </div>

        {referral?.referralCode ? (
          <div className="item-card" style={{ marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <h3>Code parrain</h3>
              <p>
                {referral.referralCode}
                {typeof referral.referredCount === 'number'
                  ? ` · ${referral.referredCount} filleul${referral.referredCount > 1 ? 's' : ''}`
                  : ''}
                {referral.totalRewardTickets
                  ? ` · ${formatTickets(referral.totalRewardTickets)} gagnés`
                  : ''}
              </p>
            </div>
            <button type="button" className="link-accent" onClick={copyCode}>
              Copier
            </button>
          </div>
        ) : null}

        <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
