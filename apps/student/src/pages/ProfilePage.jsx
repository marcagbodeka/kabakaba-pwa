import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  campusApi,
  notificationsApi,
  partnerApplicationsApi,
  referralsApi,
  reportsApi,
  userApi,
} from '../lib/api';
import { PhoneFormatter, formatTickets, formatTime, initialsFrom } from '../lib/format';
import { IconBack } from '../components/icons';

const REPORT_LABEL = {
  WRONG_MEAL: 'Mauvais repas',
  MISSING_COMPONENT: 'Composant manquant',
  INCOMPLETE_ORDER: 'Commande incomplète',
  OTHER: 'Autre',
};

export default function ProfilePage({ showSnack }) {
  const { user, logout, forget, refreshMe } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState('home');
  const [campusName, setCampusName] = useState('');
  const [referral, setReferral] = useState(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [notifyOrders, setNotifyOrders] = useState(user?.notifyOrders !== false);
  const [notifyPromotions, setNotifyPromotions] = useState(user?.notifyPromotions !== false);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState(null);
  const [reports, setReports] = useState([]);
  const [report, setReport] = useState(null);
  const [partner, setPartner] = useState({
    structureName: '',
    contactName: '',
    phone: '',
    email: '',
    targetCampus: '',
    message: '',
  });

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

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await userApi.uploadAvatar(file);
      await refreshMe();
      showSnack?.('Photo mise à jour', 'success');
    } catch (err) {
      showSnack?.(err.message || 'Envoi impossible');
    } finally {
      setUploading(false);
    }
  };

  const copyCode = async () => {
    const code = referral?.referralCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showSnack?.('Code copié', 'success');
    } catch {
      showSnack?.(code, 'info');
    }
  };

  const openEdit = async () => {
    setPanel('edit');
    if (!user?.id) return;
    try {
      const fresh = await userApi.get(user.id);
      setFirstName(fresh?.firstName || '');
      setLastName(fresh?.lastName || '');
      setNotifyOrders(fresh?.notifyOrders !== false);
      setNotifyPromotions(fresh?.notifyPromotions !== false);
    } catch (e) {
      showSnack?.(e.message || 'Profil indisponible');
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await userApi.update(user.id, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        notifyOrders,
        notifyPromotions,
      });
      await refreshMe();
      showSnack?.('Profil mis à jour', 'success');
      setPanel('home');
    } catch (e) {
      showSnack?.(e.message || 'Mise à jour impossible');
    } finally {
      setBusy(false);
    }
  };

  const openNotes = async () => {
    setPanel('notes');
    setNote(null);
    try {
      setNotes(await notificationsApi.list());
    } catch (e) {
      showSnack?.(e.message || 'Notifications indisponibles');
    }
  };

  const openNote = async (item) => {
    try {
      const full = await notificationsApi.get(item.id);
      setNote(full);
      if (!full.isRead) {
        await notificationsApi.markRead(item.id);
        setNotes((list) => list.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)));
      }
    } catch (e) {
      showSnack?.(e.message || 'Notification indisponible');
    }
  };

  const openReports = async () => {
    setPanel('reports');
    setReport(null);
    try {
      setReports(await reportsApi.list());
    } catch (e) {
      showSnack?.(e.message || 'Signalements indisponibles');
    }
  };

  const openReport = async (item) => {
    try {
      setReport(await reportsApi.get(item.id));
    } catch (e) {
      showSnack?.(e.message || 'Signalement indisponible');
    }
  };

  const sendPartner = async () => {
    if (!PhoneFormatter.isValidLocal(partner.phone)) {
      showSnack?.('Numéro invalide');
      return;
    }
    setBusy(true);
    try {
      await partnerApplicationsApi.create({
        structureName: partner.structureName.trim(),
        contactName: partner.contactName.trim(),
        phone: PhoneFormatter.toE164(partner.phone),
        email: partner.email.trim(),
        targetCampus: partner.targetCampus.trim(),
        message: partner.message.trim() || undefined,
      });
      setPartner({
        structureName: '',
        contactName: '',
        phone: '',
        email: '',
        targetCampus: '',
        message: '',
      });
      showSnack?.('Demande envoyée', 'success');
      setPanel('home');
    } catch (e) {
      showSnack?.(e.message || 'Envoi impossible');
    } finally {
      setBusy(false);
    }
  };

  if (panel !== 'home') {
    const title = {
      edit: 'Mon profil',
      notes: 'Notifications',
      reports: 'Signalements',
      partner: 'Proposer une cantine',
    }[panel];
    return (
      <div className="page">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn"
            aria-label="Retour"
            onClick={() => {
              if (note) setNote(null);
              else if (report) setReport(null);
              else setPanel('home');
            }}
          >
            <IconBack />
          </button>
          <h1>{note ? note.title || 'Notification' : report ? 'Signalement' : title}</h1>
          <div style={{ width: 40 }} />
        </div>
        <div className="list-pad">
          {panel === 'edit' ? (
            <>
              <div className="field">
                <label>Prénom</label>
                <div className="input-shell">
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Nom</label>
                <div className="input-shell">
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <label className="item-card" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={notifyOrders}
                  onChange={(e) => setNotifyOrders(e.target.checked)}
                />
                <span style={{ marginLeft: 10 }}>Alertes de commandes</span>
              </label>
              <label className="item-card" style={{ marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={notifyPromotions}
                  onChange={(e) => setNotifyPromotions(e.target.checked)}
                />
                <span style={{ marginLeft: 10 }}>Promotions</span>
              </label>
              <button
                type="button"
                className="btn-fill"
                style={{ marginTop: 16 }}
                disabled={busy || !firstName.trim() || !lastName.trim()}
                onClick={saveProfile}
              >
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          ) : null}

          {panel === 'notes' && !note
            ? notes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="order-card"
                  onClick={() => openNote(item)}
                >
                  <h3>{item.title || 'Notification'}</h3>
                  <p>
                    {item.message || ''}
                    {item.createdAt ? ` · ${formatTime(item.createdAt)}` : ''}
                  </p>
                  {!item.isRead ? <span className="status">Non lue</span> : null}
                </button>
              ))
            : null}
          {panel === 'notes' && !note && !notes.length ? (
            <div className="empty">
              <h3>Aucune notification</h3>
              <p>Les alertes de commande apparaîtront ici.</p>
            </div>
          ) : null}
          {note ? (
            <div className="item-card">
              <div>
                <h3>{note.title || 'Notification'}</h3>
                <p>{note.message || ''}</p>
                <p>{formatTime(note.createdAt)}</p>
              </div>
            </div>
          ) : null}

          {panel === 'reports' && !report
            ? reports.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="order-card"
                  onClick={() => openReport(item)}
                >
                  <h3>{REPORT_LABEL[item.type] || item.type}</h3>
                  <p>
                    {item.status || 'Ouvert'}
                    {item.createdAt ? ` · ${formatTime(item.createdAt)}` : ''}
                  </p>
                </button>
              ))
            : null}
          {panel === 'reports' && !report && !reports.length ? (
            <div className="empty">
              <h3>Aucun signalement</h3>
              <p>Tu peux signaler une commande prête ou récupérée depuis son détail.</p>
            </div>
          ) : null}
          {report ? (
            <div className="item-card">
              <div>
                <h3>{REPORT_LABEL[report.type] || report.type}</h3>
                <p>{report.comment || 'Sans précision'}</p>
                <p>{report.status || 'Ouvert'}</p>
              </div>
            </div>
          ) : null}

          {panel === 'partner' ? (
            <>
              {[
                ['structureName', 'Nom de la structure'],
                ['contactName', 'Contact'],
                ['email', 'Email'],
                ['targetCampus', 'Campus visé'],
                ['message', 'Message (optionnel)'],
              ].map(([key, label]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <div className="input-shell">
                    <input
                      value={partner[key]}
                      onChange={(e) => setPartner((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
              <div className="field">
                <label>Téléphone</label>
                <div className="input-shell">
                  <span className="prefix">+228</span>
                  <input
                    value={partner.phone}
                    inputMode="numeric"
                    placeholder="90 12 34 56"
                    onChange={(e) =>
                      setPartner((p) => ({
                        ...p,
                        phone: PhoneFormatter.formatDisplay(
                          PhoneFormatter.digitsOf(e.target.value).slice(0, 8),
                        ),
                      }))
                    }
                  />
                </div>
              </div>
              <button
                type="button"
                className="btn-fill"
                disabled={
                  busy ||
                  !partner.structureName.trim() ||
                  !partner.contactName.trim() ||
                  !partner.email.trim() ||
                  !partner.targetCampus.trim() ||
                  !PhoneFormatter.isValidLocal(partner.phone)
                }
                onClick={sendPartner}
              >
                {busy ? 'Envoi…' : 'Envoyer la demande'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="topbar">
        <div style={{ width: 40 }} />
        <h1>Profil</h1>
        <div style={{ width: 40 }} />
      </div>
      <div className="list-pad">
        <div className="item-card" style={{ alignItems: 'center', gap: 14 }}>
          <button
            type="button"
            className="profile-avatar-btn"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            aria-label="Changer la photo"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span>{initialsFrom(`${user?.firstName || ''} ${user?.lastName || ''}`)}</span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={onAvatarPick}
          />
          <div style={{ flex: 1 }}>
            <h3>
              {user?.firstName || ''} {user?.lastName || ''}
            </h3>
            <p>{phone}</p>
            {campusName ? <p>{campusName}</p> : null}
            {user?.hasPin ? <p>Code PIN activé</p> : null}
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

        <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={openEdit}>
          Modifier mon profil
        </button>
        <button type="button" className="btn-outline" style={{ marginTop: 10 }} onClick={openNotes}>
          Notifications
        </button>
        <button type="button" className="btn-outline" style={{ marginTop: 10 }} onClick={openReports}>
          Mes signalements
        </button>
        <button
          type="button"
          className="btn-outline"
          style={{ marginTop: 10 }}
          onClick={() => setPanel('partner')}
        >
          Proposer une cantine
        </button>

        <button type="button" className="btn-outline" style={{ marginTop: 16 }} onClick={logout}>
          Se déconnecter
        </button>
        <button
          type="button"
          className="btn-outline"
          style={{ marginTop: 10 }}
          onClick={async () => {
            const ok = window.confirm(
              'Oublier ce téléphone ? Tu pourras te reconnecter avec ton numéro et ton code PIN, ou via SMS si tu l’as oublié.',
            );
            if (ok) await forget();
          }}
        >
          Utiliser un autre compte
        </button>
      </div>
    </div>
  );
}
