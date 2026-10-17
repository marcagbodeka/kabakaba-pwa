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
import { PhoneFormatter, formatTicketCount, formatTime, initialsFrom } from '../lib/format';
import { IconBack } from '../components/icons';

function MiniIcon({ children }) {
  return <span className="nav-row-icon">{children}</span>;
}

const REPORT_LABEL = {
  WRONG_MEAL: 'Mauvais repas',
  MISSING_COMPONENT: 'Composant manquant',
  INCOMPLETE_ORDER: 'Commande incomplète',
  OTHER: 'Autre',
};

export default function ProfilePage({ showSnack, initialPanel }) {
  const { user, logout, forget, refreshMe } = useAuth();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState(initialPanel || 'home');
  const [campusName, setCampusName] = useState('');
  const [referral, setReferral] = useState(null);
  const [busy, setBusy] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [notifyOrders, setNotifyOrders] = useState(user?.notifyOrders !== false);
  const [notifyPromotions, setNotifyPromotions] = useState(!!user?.notifyPromotions);
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
    : 'Non renseigné';

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || 'Étudiant';

  useEffect(() => {
    if (initialPanel && initialPanel !== 'home') setPanel(initialPanel);
  }, [initialPanel]);

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

  useEffect(() => {
    setNotifyOrders(user?.notifyOrders !== false);
    setNotifyPromotions(!!user?.notifyPromotions);
  }, [user?.notifyOrders, user?.notifyPromotions]);

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showSnack?.('Choisis une image (JPG, PNG…)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showSnack?.('Image trop lourde (max 5 Mo)');
      return;
    }
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
      setNotifyPromotions(!!fresh?.notifyPromotions);
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

  const setNotify = async ({ orders, promos }) => {
    if (!user?.id) return;
    const nextOrders = orders ?? notifyOrders;
    const nextPromos = promos ?? notifyPromotions;
    setNotifyOrders(nextOrders);
    setNotifyPromotions(nextPromos);
    try {
      await userApi.update(user.id, {
        notifyOrders: nextOrders,
        notifyPromotions: nextPromos,
      });
      await refreshMe();
    } catch (e) {
      setNotifyOrders(user?.notifyOrders !== false);
      setNotifyPromotions(!!user?.notifyPromotions);
      showSnack?.(e.message || 'Préférence non enregistrée');
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

  useEffect(() => {
    if (initialPanel === 'notes') openNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const confirmLogout = async () => {
    if (window.confirm('Te déconnecter de kabakaba ?')) await logout();
  };

  if (panel !== 'home') {
    const title = {
      edit: 'Modifier mon profil',
      notes: 'Notifications',
      reports: 'Signalements',
      partner: 'Proposer une cantine',
      help: 'Centre d’aide',
      referral: 'Parrainage',
      about: 'À propos',
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

          {panel === 'help' ? (
            <div className="settings-card">
              <button type="button" className="nav-row" onClick={openReports}>
                <MiniIcon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h12v16l-3-2-3 2-3-2-3 2V4Z"/><path d="M8 9h6M8 13h4"/></svg>
                </MiniIcon>
                <span className="nav-row-body">
                  <strong>Mes signalements</strong>
                  <span>Litiges et commandes</span>
                </span>
                <span className="nav-row-chevron">›</span>
              </button>
              <button type="button" className="nav-row" onClick={() => setPanel('partner')}>
                <MiniIcon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9h18l-1 11H4L3 9Z"/><path d="M3 9 5 4h14l2 5"/></svg>
                </MiniIcon>
                <span className="nav-row-body">
                  <strong>Proposer une cantine</strong>
                  <span>Devenir partenaire</span>
                </span>
                <span className="nav-row-chevron">›</span>
              </button>
              <button type="button" className="nav-row" onClick={() => setPanel('about')}>
                <MiniIcon>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>
                </MiniIcon>
                <span className="nav-row-body">
                  <strong>À propos</strong>
                </span>
                <span className="nav-row-chevron">›</span>
              </button>
            </div>
          ) : null}

          {panel === 'about' ? (
            <div className="item-card">
              <div>
                <h3>kabakaba</h3>
                <p>Commande campus · tickets · retrait sans file.</p>
                <p>Compte étudiant</p>
              </div>
            </div>
          ) : null}

          {panel === 'referral' ? (
            <div className="amb-card">
              <div className="amb-card-top">
                <span className="amb-chip">{referral?.referralCode || 'PARRAINAGE'}</span>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb347" strokeWidth="2"><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"/></svg>
              </div>
              <h3>Parrainage kabakaba</h3>
              <p>
                {referral
                  ? `${referral.referredCount || 0} filleuls · ${formatTicketCount(referral.totalRewardTickets || 0)} tickets gagnés`
                  : 'Partage ton code : 100 tickets à la 1re recharge d’un filleul.'}
              </p>
              <div className="amb-stats">
                <div>
                  <label>FILLEULS</label>
                  <strong>{referral?.referredCount ?? 0}</strong>
                </div>
                <div>
                  <label>TICKETS</label>
                  <strong>{formatTicketCount(referral?.totalRewardTickets || 0)}</strong>
                </div>
              </div>
              {referral?.referralCode ? (
                <button type="button" className="btn-fill" style={{ marginTop: 12 }} onClick={copyCode}>
                  Copier mon code
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="page page--flush">
      <div className="hero hero--profile">
        <div className="hero-top">
          <div>
            <div className="hero-greet">Mon profil</div>
            <div className="hero-name">{user?.firstName || 'Étudiant'}</div>
          </div>
          <button
            type="button"
            className="hero-icon-btn"
            aria-label="Paramètres"
            onClick={() => setPanel('help')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
          </button>
        </div>

        <button type="button" className="profile-hero-user" onClick={openEdit}>
          <span
            className="profile-hero-avatar"
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span>{initialsFrom(displayName)}</span>
            )}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={onAvatarPick}
            disabled={uploading}
          />
          <span className="profile-hero-meta">
            <strong>{displayName}</strong>
            <span>{campusName || 'Campus non défini'}</span>
          </span>
          <svg className="profile-hero-edit" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>
      </div>

      <div className="sheet-body sheet-body--profile">
        <div className="section-label">Informations personnelles</div>
        <div className="settings-card">
          <div className="field-row">
            <span>Prénom(s)</span>
            <strong>{user?.firstName?.trim() || '—'}</strong>
          </div>
          <div className="field-row">
            <span>Nom</span>
            <strong>{user?.lastName?.trim() || '—'}</strong>
          </div>
          <div className="field-row">
            <span>Téléphone</span>
            <strong className="locked">{phone}</strong>
          </div>
        </div>

        <div className="section-label">Campus</div>
        <div className="settings-card">
          <button type="button" className="nav-row" onClick={() => showSnack?.('Campus géré sur dossier')}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m12 3 9 5v2H3V8l9-5Z"/><path d="M5 10v7h14v-7"/><path d="M9 21v-4h6v4"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>{campusName || 'Campus non défini'}</strong>
              <span>Changer de campus sur dossier</span>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
        </div>

        <div className="section-label">Notifications</div>
        <div className="settings-card">
          <label className="toggle-row">
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2h9l3 3v17H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Mes commandes</strong>
              <span>Acceptation, refus, prête</span>
            </span>
            <input
              type="checkbox"
              checked={notifyOrders}
              onChange={(e) => setNotify({ orders: e.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.6 12.6a2 2 0 0 0 0-2.8l-1.4-1.4a2 2 0 0 0-2.8 0L5 19.8V22h2.2l13.4-9.4Z"/><path d="m15 6 3 3"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Promotions & nouveautés</strong>
              <span>Offres et actualités kabakaba</span>
            </span>
            <input
              type="checkbox"
              checked={notifyPromotions}
              onChange={(e) => setNotify({ promos: e.target.checked })}
            />
          </label>
        </div>

        <div className="amb-card">
          <div className="amb-card-top">
            <span className="amb-chip">{referral?.referralCode || 'PARRAINAGE'}</span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffb347" strokeWidth="2"><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"/></svg>
          </div>
          <h3>Parrainage kabakaba</h3>
          <p>
            {referral
              ? `${referral.referredCount || 0} filleuls · ${formatTicketCount(referral.totalRewardTickets || 0)} tickets gagnés`
              : 'Partage ton code : 100 tickets à la 1re recharge d’un filleul.'}
          </p>
          <div className="amb-stats">
            <div>
              <label>FILLEULS</label>
              <strong>{referral?.referredCount ?? 0}</strong>
            </div>
            <div>
              <label>TICKETS</label>
              <strong>{formatTicketCount(referral?.totalRewardTickets || 0)}</strong>
            </div>
          </div>
          <button type="button" className="btn-fill amb-cta" onClick={() => setPanel('referral')}>
            Voir mon code
          </button>
        </div>

        <div className="section-label">Plus</div>
        <div className="settings-card">
          <button type="button" className="nav-row" onClick={() => setPanel('help')}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.4 2.6C12.5 12.3 12 13 12 14"/><path d="M12 17h.01"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Centre d’aide</strong>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
          <button type="button" className="nav-row" onClick={openNotes}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.7 9.1c0-3.3 2.4-5.9 5.3-5.9s5.3 2.6 5.3 5.9l1.1 4.5c.2.7-.3 1.4-1 1.4H6.6c-.7 0-1.2-.7-1-1.4l1.1-4.5Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Notifications</strong>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
          <button type="button" className="nav-row" onClick={() => setPanel('about')}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>À propos</strong>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
          <button
            type="button"
            className="nav-row"
            onClick={async () => {
              const ok = window.confirm(
                'Oublier ce téléphone ? Tu pourras te reconnecter avec ton numéro et ton code PIN, ou via SMS si tu l’as oublié.',
              );
              if (ok) await forget();
            }}
          >
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5"/><path d="M21 3 13 11"/><path d="M8 21H3v-5"/><path d="m3 21 8-8"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Utiliser un autre compte</strong>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
        </div>

        <button type="button" className="btn-logout" onClick={confirmLogout}>
          Se déconnecter
        </button>
        <p className="profile-footnote">kabakaba · compte étudiant</p>
      </div>
    </div>
  );
}
