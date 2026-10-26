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
import { readView, writeView } from '../lib/instantView';
import { useThemeMode } from '../lib/theme';
import { IconBack } from '../components/icons';
import { useConfirm } from '../components/ConfirmDialog';
import {
  getNotificationPermission,
  getPushBlockedHelp,
  isWebPushConfigured,
  registerWebPush,
} from '../lib/push';

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
  const confirm = useConfirm();
  const { mode: themeMode, choose: chooseTheme } = useThemeMode();
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
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPerm, setPushPerm] = useState(() => getNotificationPermission());
  const [pushOn, setPushOn] = useState(() => getNotificationPermission() === 'granted');

  useEffect(() => {
    const syncPerm = () => {
      const perm = getNotificationPermission();
      setPushPerm(perm);
      if (perm === 'granted' && isWebPushConfigured()) {
        registerWebPush()
          .then((token) => setPushOn(Boolean(token) || perm === 'granted'))
          .catch(() => setPushOn(true));
      } else {
        setPushOn(false);
      }
    };
    syncPerm();
    const onVis = () => {
      if (document.visibilityState === 'visible') syncPerm();
    };
    window.addEventListener('focus', syncPerm);
    document.addEventListener('visibilitychange', onVis);
    let permStatus;
    try {
      navigator.permissions
        ?.query({ name: 'notifications' })
        .then((status) => {
          permStatus = status;
          status.onchange = syncPerm;
        })
        .catch(() => {});
    } catch {
      /* ignore */
    }
    return () => {
      window.removeEventListener('focus', syncPerm);
      document.removeEventListener('visibilitychange', onVis);
      if (permStatus) permStatus.onchange = null;
    };
  }, []);
  const [notes, setNotes] = useState([]);
  const [noteDay, setNoteDay] = useState(0);
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
    const cachedName = readView(`campus:${user.campusId}`);
    if (typeof cachedName === 'string') setCampusName(cachedName);
    campusApi
      .get(user.campusId)
      .then((c) => {
        const name = c?.name || '';
        setCampusName(name);
        if (name) writeView(`campus:${user.campusId}`, name);
      })
      .catch(() => {
        if (!cachedName) setCampusName('');
      });
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
    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setNotifyOrders(user?.notifyOrders !== false);
    setNotifyPromotions(!!user?.notifyPromotions);
    setPanel('edit');
    try {
      const fresh = await refreshMe();
      setFirstName(fresh?.firstName || '');
      setLastName(fresh?.lastName || '');
      setNotifyOrders(fresh?.notifyOrders !== false);
      setNotifyPromotions(!!fresh?.notifyPromotions);
    } catch {
      /* garde les valeurs locales si /me échoue */
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

  const enableDevicePush = async () => {
    if (pushOn || pushBusy || !isWebPushConfigured()) return;
    setPushBusy(true);
    try {
      try {
        sessionStorage.removeItem('kabakaba_student_push_later');
      } catch {
        /* ignore */
      }
      const token = await registerWebPush({ forcePrompt: true });
      const perm = getNotificationPermission();
      setPushPerm(perm);
      if (token) {
        setPushOn(true);
        showSnack?.('Notifications activées', 'success');
      } else {
        setPushOn(false);
        showSnack?.(
          perm === 'denied'
            ? getPushBlockedHelp()
            : 'Accepte la popup du navigateur pour activer',
        );
      }
    } finally {
      setPushBusy(false);
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
    const ok = await confirm({
      title: 'Se déconnecter',
      message: 'Tu reviendras à l’écran PIN sur cet appareil.',
      confirmLabel: 'Déconnecter',
      danger: true,
    });
    if (ok) await logout();
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
            className="soft-back"
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
              <div className="profile-edit-photo">
                <button
                  type="button"
                  className="profile-edit-avatar"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  aria-label="Changer la photo de profil"
                >
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    <span>{initialsFrom(displayName)}</span>
                  )}
                  <span className="profile-edit-avatar-badge" aria-hidden>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                </button>
                <div className="profile-edit-photo-copy">
                  <strong>Photo de profil</strong>
                  <span>JPG, PNG ou WebP · 5 Mo max</span>
                  <button
                    type="button"
                    className="link-accent"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? 'Envoi…' : user?.avatarUrl ? 'Changer la photo' : 'Ajouter une photo'}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={onAvatarPick}
                  disabled={uploading}
                />
              </div>

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

          {panel === 'notes' && !note ? (
            <>
              <div className="light-tabs" style={{ marginBottom: 14 }}>
                {['Aujourd’hui', 'Hier'].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    className={`light-tab${noteDay === i ? ' active' : ''}`}
                    onClick={() => setNoteDay(i)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="note-list">
                {notes
                  .filter((item) => {
                    const offset = (() => {
                      const d = new Date(item.createdAt);
                      if (Number.isNaN(d.getTime())) return null;
                      const n = new Date();
                      const start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
                      const other = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                      return Math.round((start - other) / 86400000);
                    })();
                    return offset === noteDay;
                  })
                  .slice(0, 20)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="note-card"
                      onClick={() => openNote(item)}
                    >
                      <h3>{item.title || 'Notification'}</h3>
                      <p>
                        {String(item.message || '').replace(
                          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
                          '',
                        )}
                        {item.createdAt ? ` · ${formatTime(item.createdAt)}` : ''}
                      </p>
                      {!item.isRead ? <span className="status">Non lue</span> : null}
                    </button>
                  ))}
              </div>
            </>
          ) : null}
          {panel === 'notes' && !note && !notes.filter((item) => {
            const d = new Date(item.createdAt);
            if (Number.isNaN(d.getTime())) return false;
            const n = new Date();
            const start = new Date(n.getFullYear(), n.getMonth(), n.getDate());
            const other = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            return Math.round((start - other) / 86400000) === noteDay;
          }).length ? (
            <div className="empty">
              <h3>{noteDay === 0 ? 'Rien aujourd’hui' : 'Rien hier'}</h3>
              <p>Les alertes plus anciennes ne s’affichent plus.</p>
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
                <span className="amb-chip">{referral?.referralCode || user?.referralCode || 'PARRAINAGE'}</span>
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

        <div className="profile-hero-user">
          <button
            type="button"
            className="profile-hero-avatar"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Changer la photo"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span>{initialsFrom(displayName)}</span>
            )}
            <span className="profile-hero-avatar-cam" aria-hidden>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </span>
          </button>
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
            <span>{uploading ? 'Envoi de la photo…' : campusName || phone}</span>
          </span>
          <button type="button" className="profile-hero-edit-btn" onClick={openEdit}>
            Modifier
          </button>
        </div>
      </div>

      <div className="sheet-body sheet-body--profile">
        <div className="section-label">Compte</div>
        <div className="settings-card">
          <button type="button" className="profile-field" onClick={openEdit}>
            <span className="profile-field-label">Prénom</span>
            <span className="profile-field-value">{user?.firstName?.trim() || '—'}</span>
            <span className="nav-row-chevron">›</span>
          </button>
          <button type="button" className="profile-field" onClick={openEdit}>
            <span className="profile-field-label">Nom</span>
            <span className="profile-field-value">{user?.lastName?.trim() || '—'}</span>
            <span className="nav-row-chevron">›</span>
          </button>
          <div className="profile-field">
            <span className="profile-field-label">Téléphone</span>
            <span className="profile-field-value">{phone}</span>
          </div>
          <button
            type="button"
            className="profile-field"
            onClick={() => showSnack?.('Campus géré sur dossier')}
          >
            <span className="profile-field-label">Campus</span>
            <span className="profile-field-value">{campusName || 'Non défini'}</span>
            <span className="nav-row-chevron">›</span>
          </button>
        </div>

        <div className="section-label">Notifications</div>
        <div className="settings-card">
          {pushPerm === 'denied' ? (
            <button
              type="button"
              className="profile-field"
              onClick={() => showSnack?.(getPushBlockedHelp())}
            >
              <span className="profile-field-label">Cet appareil</span>
              <span className="profile-field-value">Bloquées</span>
              <span className="nav-row-chevron">›</span>
            </button>
          ) : (
            <label className="toggle-row">
              <span className="nav-row-body">
                <strong>Cet appareil</strong>
                <span>
                  {pushBusy ? 'Activation…' : pushOn ? 'Activées' : 'Désactivées'}
                </span>
              </span>
              <input
                type="checkbox"
                checked={pushOn}
                disabled={pushBusy || pushOn || !isWebPushConfigured()}
                onChange={(e) => {
                  if (e.target.checked) enableDevicePush();
                }}
              />
            </label>
          )}
          <label className="toggle-row">
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
            <span className="nav-row-body">
              <strong>Promotions</strong>
              <span>Offres et actualités</span>
            </span>
            <input
              type="checkbox"
              checked={notifyPromotions}
              onChange={(e) => setNotify({ promos: e.target.checked })}
            />
          </label>
          <button type="button" className="nav-row" onClick={openNotes}>
            <span className="nav-row-body">
              <strong>Reçues</strong>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
        </div>

        <div className="section-label">Apparence</div>
        <div className="settings-card">
          {[
            ['light', 'Clair'],
            ['dark', 'Sombre'],
            ['system', 'Système'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className="profile-field"
              aria-pressed={themeMode === id}
              onClick={() => chooseTheme(id)}
            >
              <span className="profile-field-label">{label}</span>
              {themeMode === id ? <span className="profile-field-check">✓</span> : null}
            </button>
          ))}
        </div>

        <div className="section-label">Plus</div>
        <div className="settings-card">
          <button type="button" className="nav-row" onClick={() => setPanel('referral')}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 12v8H4v-8"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7Z"/><path d="M12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7Z"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Parrainage</strong>
              <span>
                {referral
                  ? `${referral.referredCount || 0} filleuls · ${formatTicketCount(referral.totalRewardTickets || 0)} tickets`
                  : 'Ton code et tes filleuls'}
              </span>
            </span>
            <span className="nav-row-chevron">›</span>
          </button>
          <button type="button" className="nav-row" onClick={() => setPanel('help')}>
            <MiniIcon>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.4 2.6C12.5 12.3 12 13 12 14"/><path d="M12 17h.01"/></svg>
            </MiniIcon>
            <span className="nav-row-body">
              <strong>Centre d’aide</strong>
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
              const ok = await confirm({
                title: 'Utiliser un autre compte',
                message:
                  'Oublier ce téléphone ? Tu pourras te reconnecter avec ton numéro et ton code PIN, ou via SMS si tu l’as oublié.',
                confirmLabel: 'Oublier',
                danger: true,
              });
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
