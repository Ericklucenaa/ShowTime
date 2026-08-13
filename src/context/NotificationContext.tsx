import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext.js';
import { useTracking } from './TrackingContext.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore/lite';
import { fetchMediaDetails, fetchSeasonEpisodes, getImageUrl } from '../services/api.js';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

export interface NotificationItem {
  id: string;
  userId: string;
  type: 'episode_release' | 'episode_reminder' | 'new_follower' | 'comment_reply' | 'system' | 'direct_message';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  mediaId?: string;
  mediaType?: 'show' | 'movie';
  mediaTitle?: string;
  posterPath?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  senderId?: string;
  senderUsername?: string;
  senderAvatarUrl?: string;
}

export interface EpisodeReminder {
  id: string;
  showId: string;
  showTitle: string;
  posterPath?: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle?: string;
  airDate: string; // YYYY-MM-DD or ISO
  createdAt: string;
  notified?: boolean;
  notifiedDate?: string;
}

export type EpisodeReminderInput = Omit<EpisodeReminder, 'id' | 'createdAt' | 'notified' | 'notifiedDate'>;

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  reminders: EpisodeReminder[];
  browserNotificationPermission: NotificationPermission | 'unsupported';
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  createNotification: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => Promise<void>;
  refreshNotifications: () => Promise<void>;
  isReminderActive: (showId: string, seasonNumber: number, episodeNumber: number) => boolean;
  toggleEpisodeReminder: (item: EpisodeReminderInput) => Promise<boolean>;
  removeEpisodeReminder: (reminderId: string) => Promise<void>;
  requestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  checkReleasesAndReminders: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDateToKey(rawDate?: string): string {
  if (!rawDate) return '';
  if (rawDate.length === 10 && rawDate.includes('-')) return rawDate;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return '';
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildReminderId(showId: string, seasonNumber: number, episodeNumber: number): string {
  return `rem_${showId}_s${seasonNumber}_e${episodeNumber}`;
}

function sendDesktopAlert(title: string, options: { body: string; icon?: string; tag?: string; data?: any }) {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }
  try {
    const notif = new Notification(title, {
      body: options.body,
      icon: options.icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: options.tag,
      data: options.data
    });
    notif.onclick = () => {
      window.focus();
      if (options.data) {
        window.dispatchEvent(new CustomEvent('epsync:open-media', { detail: options.data }));
        window.dispatchEvent(new CustomEvent('showtime:open-media', { detail: options.data }));
      }
      notif.close();
    };
    return notif;
  } catch (err) {
    console.warn('Could not send native desktop notification:', err);
    return null;
  }
}

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { followedShows, blockedUsers, mutedUsers } = useTracking();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reminders, setReminders] = useState<EpisodeReminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const isCheckingRef = useRef(false);

  // Request browser desktop notification permission
  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setBrowserNotificationPermission('unsupported');
      return 'unsupported';
    }
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      setBrowserNotificationPermission(Notification.permission);
      return Notification.permission;
    }
    try {
      const perm = await Notification.requestPermission();
      setBrowserNotificationPermission(perm);
      if (perm === 'granted') {
        pushToast('success', '🔔 Notificações do navegador ativadas!');
      }
      return perm;
    } catch (err) {
      console.warn('Failed to request notification permission', err);
      return Notification.permission;
    }
  }, []);

  // Load reminders from localStorage & Firestore
  useEffect(() => {
    const loadReminders = async () => {
      const localKey = user ? `epsync_reminders_${user.id}` : 'epsync_episode_reminders';
      const legacyKey = user ? `showtime_reminders_${user.id}` : 'showtime_episode_reminders';
      let localList: EpisodeReminder[] = [];

      try {
        const raw = localStorage.getItem(localKey) || localStorage.getItem(legacyKey) || localStorage.getItem('showtime_episode_reminders');
        if (raw) {
          localList = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('Error reading local reminders:', err);
      }

      // Also migrate legacy calendar reminders string IDs if needed
      try {
        const legacyRaw = localStorage.getItem('showtime_calendar_reminders');
        if (legacyRaw) {
          const legacyIds: string[] = JSON.parse(legacyRaw);
          legacyIds.forEach(id => {
            if (!localList.some(r => r.id === id || id.includes(r.showId))) {
              // Extract basic info from cal_showId_season_ep
              const parts = id.split('_');
              if (parts.length >= 4) {
                const sId = parts[1];
                const sNum = parseInt(parts[2], 10) || 1;
                const eNum = parseInt(parts[3], 10) || 1;
                localList.push({
                  id: buildReminderId(sId, sNum, eNum),
                  showId: sId,
                  showTitle: 'Série',
                  seasonNumber: sNum,
                  episodeNumber: eNum,
                  airDate: '',
                  createdAt: new Date().toISOString()
                });
              }
            }
          });
        }
      } catch (_) {}

      if (user && isFirebaseEnabled && db) {
        try {
          const q = query(collection(db, 'reminders'), where('userId', '==', user.id));
          const snap = await getDocs(q);
          const remoteList: EpisodeReminder[] = snap.docs.map(d => {
            const data = d.data();
            return {
              id: d.id,
              showId: data.showId,
              showTitle: data.showTitle || 'Série',
              posterPath: data.posterPath,
              seasonNumber: Number(data.seasonNumber) || 1,
              episodeNumber: Number(data.episodeNumber) || 1,
              episodeTitle: data.episodeTitle,
              airDate: data.airDate || '',
              createdAt: data.createdAt || new Date().toISOString(),
              notified: Boolean(data.notified),
              notifiedDate: data.notifiedDate
            };
          });

          // Merge local and remote
          const map = new Map<string, EpisodeReminder>();
          localList.forEach(r => map.set(r.id, r));
          remoteList.forEach(r => map.set(r.id, r));
          const merged = Array.from(map.values());
          setReminders(merged);
          localStorage.setItem(localKey, JSON.stringify(merged));
          return;
        } catch (err) {
          console.warn('Could not fetch cloud reminders, using local cache:', err);
        }
      }

      setReminders(localList);
    };

    loadReminders();
  }, [user]);

  // Load notifications from Firestore and localStorage
  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setLoading(true);

    const localKey = `epsync_notifications_${user.id}`;
    const legacyKey = `showtime_notifications_${user.id}`;
    const cachedStr = localStorage.getItem(localKey) || localStorage.getItem(legacyKey);
    const rawCached: NotificationItem[] = cachedStr ? JSON.parse(cachedStr) : [];
    const cached: NotificationItem[] = rawCached.map(n => ({
      ...n,
      message: n.type === 'direct_message' ? 'Enviou uma mensagem para você.' : n.message
    }));

    if (isFirebaseEnabled && db) {
      try {
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', user.id)
        );
        const snap = await getDocs(q);
        const remoteList: NotificationItem[] = snap.docs.map(d => {
          const data = d.data();
          const isDm = data.type === 'direct_message';
          return {
            id: d.id,
            userId: data.userId,
            type: data.type,
            title: data.title || (isDm ? `Mensagem de @${data.senderUsername || 'usuário'}` : 'Notificação'),
            message: isDm ? 'Enviou uma mensagem para você.' : (data.message || ''),
            read: Boolean(data.read),
            createdAt: data.createdAt || new Date().toISOString(),
            mediaId: data.mediaId,
            mediaType: data.mediaType,
            mediaTitle: data.mediaTitle,
            posterPath: data.posterPath,
            seasonNumber: data.seasonNumber,
            episodeNumber: data.episodeNumber,
            senderId: data.senderId,
            senderUsername: data.senderUsername,
            senderAvatarUrl: data.senderAvatarUrl
          };
        });

        // Merge remote and cached
        const mergedMap = new Map<string, NotificationItem>();
        cached.forEach(n => mergedMap.set(n.id, n));
        remoteList.forEach(n => mergedMap.set(n.id, n));

        const sorted = Array.from(mergedMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setNotifications(sorted);
        localStorage.setItem(localKey, JSON.stringify(sorted));
      } catch (err) {
        console.warn('Could not fetch notifications from cloud, using local cache:', err);
        setNotifications(cached);
      } finally {
        setLoading(false);
      }
    } else {
      setNotifications(cached);
      setLoading(false);
    }
  }, [user]);

  // Check today's releases for both reminders and followed shows
  const checkReleasesAndReminders = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    try {
      const todayKey = getTodayDateString();
      const currentUserId = user ? user.id : 'guest';
      const generatedNotifs: NotificationItem[] = [];
      let remindersUpdated = false;
      const updatedRemindersList = [...reminders];

      // 1. Process explicit Episode Reminders
      for (let i = 0; i < updatedRemindersList.length; i++) {
        const rem = updatedRemindersList[i];
        const remDateKey = normalizeDateToKey(rem.airDate);

        // If reminder is scheduled for today (or was scheduled for today or earlier and hasn't notified yet)
        if (remDateKey === todayKey) {
          if (!rem.notified || rem.notifiedDate !== todayKey) {
            const notifId = `reminder_${rem.showId}_s${rem.seasonNumber}_e${rem.episodeNumber}_${todayKey}`;

            const epTitle = rem.episodeTitle ? ` - "${rem.episodeTitle}"` : '';
            const message = `${rem.showTitle}: Temporada ${rem.seasonNumber}, Ep ${rem.episodeNumber}${epTitle} já está disponível hoje!`;

            generatedNotifs.push({
              id: notifId,
              userId: currentUserId,
              type: 'episode_release',
              title: '🔔 Lembrete: Lançamento de Hoje!',
              message,
              read: false,
              createdAt: new Date().toISOString(),
              mediaId: rem.showId,
              mediaType: 'show',
              mediaTitle: rem.showTitle,
              posterPath: rem.posterPath,
              seasonNumber: rem.seasonNumber,
              episodeNumber: rem.episodeNumber
            });

            // Send native desktop notification
            sendDesktopAlert(`🔔 ${rem.showTitle} - Lançado Hoje!`, {
              body: `T${rem.seasonNumber}E${rem.episodeNumber}${epTitle} já saiu. Toque para ver!`,
              icon: rem.posterPath ? getImageUrl(rem.posterPath) : undefined,
              tag: notifId,
              data: { id: rem.showId, type: 'show', seasonNumber: rem.seasonNumber, episodeNumber: rem.episodeNumber }
            });

            // Show in-app toast
            pushToast('info', `🔔 Lembrete: Novo episódio de ${rem.showTitle} (T${rem.seasonNumber}E${rem.episodeNumber}) saiu hoje!`, 5000);

            // Mark reminder as notified for today
            updatedRemindersList[i] = {
              ...rem,
              notified: true,
              notifiedDate: todayKey
            };
            remindersUpdated = true;
          }
        }
      }

      // 2. Process Followed Shows (up to 20 shows)
      if (user && followedShows.length > 0) {
        for (const showId of followedShows.slice(0, 20)) {
          try {
            const show = await fetchMediaDetails(showId, 'show');
            if (!show || !show.seasons || !show.seasons.length) continue;

            const latestSeason = show.seasons[show.seasons.length - 1];
            if (!latestSeason) continue;

            let episodes = latestSeason.episodes || [];
            if (!episodes.length) {
              try {
                episodes = await fetchSeasonEpisodes(show.id, latestSeason.seasonNumber);
              } catch (_) {}
            }

            const releasingToday = episodes.filter((ep: any) => normalizeDateToKey(ep.airDate) === todayKey);
            for (const ep of releasingToday) {
              const notifId = `release_${show.id}_s${latestSeason.seasonNumber}_e${ep.episodeNumber}_${todayKey}`;

              // Don't duplicate if already generated via reminder
              if (!generatedNotifs.some(n => n.id === notifId || (n.mediaId === show.id && n.seasonNumber === latestSeason.seasonNumber && n.episodeNumber === ep.episodeNumber))) {
                const epTitle = ep.title ? ` - "${ep.title}"` : '';
                const message = `${show.title}: Temporada ${latestSeason.seasonNumber}, Ep ${ep.episodeNumber}${epTitle} lançado hoje!`;

                generatedNotifs.push({
                  id: notifId,
                  userId: user.id,
                  type: 'episode_release',
                  title: 'Novo episódio lançado hoje!',
                  message,
                  read: false,
                  createdAt: new Date().toISOString(),
                  mediaId: show.id,
                  mediaType: 'show',
                  mediaTitle: show.title,
                  posterPath: show.posterPath,
                  seasonNumber: latestSeason.seasonNumber,
                  episodeNumber: ep.episodeNumber
                });

                sendDesktopAlert(`🎬 ${show.title} - Novo Episódio!`, {
                  body: `T${latestSeason.seasonNumber}E${ep.episodeNumber}${epTitle} está disponível hoje.`,
                  icon: show.posterPath ? getImageUrl(show.posterPath) : undefined,
                  tag: notifId,
                  data: { id: show.id, type: 'show', seasonNumber: latestSeason.seasonNumber, episodeNumber: ep.episodeNumber }
                });
              }
            }
          } catch (err) {
            console.warn('Error checking releases for show:', showId, err);
          }
        }
      }

      // Update reminders state and storage if changed
      if (remindersUpdated) {
        setReminders(updatedRemindersList);
        const localRemKey = user ? `epsync_reminders_${user.id}` : 'epsync_episode_reminders';
        localStorage.setItem(localRemKey, JSON.stringify(updatedRemindersList));
        localStorage.setItem('epsync_episode_reminders', JSON.stringify(updatedRemindersList));

        if (user && isFirebaseEnabled && db) {
          updatedRemindersList.forEach(async r => {
            try {
              await setDoc(doc(db, 'reminders', r.id), { ...r, userId: user.id });
            } catch (_) {}
          });
        }
      }

      // Save and inject generated notifications
      if (generatedNotifs.length > 0) {
        setNotifications(prev => {
          const existingIds = new Set(prev.map(n => n.id));
          const newItems = generatedNotifs.filter(n => !existingIds.has(n.id));
          if (!newItems.length) return prev;

          const updated = [...newItems, ...prev];
          const localNotifKey = user ? `epsync_notifications_${user.id}` : 'epsync_notifications_guest';
          localStorage.setItem(localNotifKey, JSON.stringify(updated));

          if (user && isFirebaseEnabled && db) {
            newItems.forEach(async item => {
              try {
                await setDoc(doc(db, 'notifications', item.id), item);
              } catch (_) {}
            });
          }

          return updated;
        });
      }
    } finally {
      isCheckingRef.current = false;
    }
  }, [user, reminders, followedShows]);

  // Initial and periodic release checking
  useEffect(() => {
    if (user) {
      refreshNotifications();
    }
  }, [user, refreshNotifications]);

  useEffect(() => {
    checkReleasesAndReminders();

    // Check periodically every 3 minutes
    const interval = setInterval(() => {
      checkReleasesAndReminders();
    }, 180000);

    // Also check when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkReleasesAndReminders();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkReleasesAndReminders]);

  // Check if reminder is active for a specific episode
  const isReminderActive = useCallback((showId: string, seasonNumber: number, episodeNumber: number): boolean => {
    const targetId = buildReminderId(showId, seasonNumber, episodeNumber);
    const legacyCalId = `cal_${showId}_${seasonNumber}_${episodeNumber}`;
    return reminders.some(r => 
      r.id === targetId || 
      r.id === legacyCalId ||
      (r.showId === showId && r.seasonNumber === seasonNumber && r.episodeNumber === episodeNumber)
    );
  }, [reminders]);

  // Toggle reminder for an episode
  const toggleEpisodeReminder = useCallback(async (item: EpisodeReminderInput): Promise<boolean> => {
    const reminderId = buildReminderId(item.showId, item.seasonNumber, item.episodeNumber);
    const legacyCalId = `cal_${item.showId}_${item.seasonNumber}_${item.episodeNumber}`;

    const alreadyActive = reminders.some(r => 
      r.id === reminderId || 
      r.id === legacyCalId ||
      (r.showId === item.showId && r.seasonNumber === item.seasonNumber && r.episodeNumber === item.episodeNumber)
    );

    const localKey = user ? `epsync_reminders_${user.id}` : 'epsync_episode_reminders';

    if (alreadyActive) {
      const next = reminders.filter(r => 
        r.id !== reminderId && 
        r.id !== legacyCalId &&
        !(r.showId === item.showId && r.seasonNumber === item.seasonNumber && r.episodeNumber === item.episodeNumber)
      );
      setReminders(next);
      localStorage.setItem(localKey, JSON.stringify(next));
      localStorage.setItem('epsync_episode_reminders', JSON.stringify(next));

      // Keep legacy string array in sync for calendar compatibility
      try {
        const raw = localStorage.getItem('showtime_calendar_reminders');
        if (raw) {
          const list: string[] = JSON.parse(raw);
          const filtered = list.filter(id => id !== reminderId && id !== legacyCalId);
          localStorage.setItem('showtime_calendar_reminders', JSON.stringify(filtered));
        }
      } catch (_) {}

      if (user && isFirebaseEnabled && db) {
        try {
          await deleteDoc(doc(db, 'reminders', reminderId));
        } catch (_) {}
      }

      pushToast('info', `Lembrete removido: ${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}`);
      trackEvent('reminder_toggled', { showId: item.showId, enabled: false });
      return false;
    } else {
      // Auto prompt for desktop notification permission if not yet decided
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        requestNotificationPermission();
      }

      const newReminder: EpisodeReminder = {
        ...item,
        id: reminderId,
        createdAt: new Date().toISOString(),
        notified: false
      };

      const next = [...reminders, newReminder];
      setReminders(next);
      localStorage.setItem(localKey, JSON.stringify(next));
      localStorage.setItem('showtime_episode_reminders', JSON.stringify(next));

      // Keep legacy string array in sync for calendar compatibility
      try {
        const raw = localStorage.getItem('showtime_calendar_reminders');
        const list: string[] = raw ? JSON.parse(raw) : [];
        if (!list.includes(legacyCalId)) list.push(legacyCalId);
        if (!list.includes(reminderId)) list.push(reminderId);
        localStorage.setItem('showtime_calendar_reminders', JSON.stringify(list));
      } catch (_) {}

      if (user && isFirebaseEnabled && db) {
        try {
          await setDoc(doc(db, 'reminders', reminderId), { ...newReminder, userId: user.id });
        } catch (_) {}
      }

      const dateLabel = item.airDate ? ` (${item.airDate})` : '';
      pushToast('success', `🔔 Lembrete ativo: ${item.showTitle} T${item.seasonNumber}E${item.episodeNumber}${dateLabel}`);
      trackEvent('reminder_toggled', { showId: item.showId, enabled: true });

      // Run release check in case it's releasing today
      setTimeout(() => {
        checkReleasesAndReminders();
      }, 500);

      return true;
    }
  }, [reminders, user, requestNotificationPermission, checkReleasesAndReminders]);

  const removeEpisodeReminder = useCallback(async (reminderId: string) => {
    const next = reminders.filter(r => r.id !== reminderId);
    setReminders(next);
    if (user) {
      localStorage.setItem(`epsync_reminders_${user.id}`, JSON.stringify(next));
      localStorage.setItem(`showtime_reminders_${user.id}`, JSON.stringify(next));
    }
    localStorage.setItem('epsync_episode_reminders', JSON.stringify(next));
    localStorage.setItem('showtime_episode_reminders', JSON.stringify(next));

    if (user && isFirebaseEnabled && db) {
      try {
        await deleteDoc(doc(db, 'reminders', reminderId));
      } catch (_) {}
    }
  }, [reminders, user]);

  const markAsRead = async (id: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, read: true } : n);
      if (user) {
        localStorage.setItem(`epsync_notifications_${user.id}`, JSON.stringify(updated));
        localStorage.setItem(`showtime_notifications_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (isFirebaseEnabled && db) {
      try {
        await updateDoc(doc(db, 'notifications', id), { read: true });
      } catch (err) {
        console.warn('Could not mark notification as read in cloud:', err);
      }
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      if (user) {
        localStorage.setItem(`epsync_notifications_${user.id}`, JSON.stringify(updated));
        localStorage.setItem(`showtime_notifications_${user.id}`, JSON.stringify(updated));
      }
      return updated;
    });

    if (isFirebaseEnabled && db && user) {
      try {
        const unreadList = notifications.filter(n => !n.read);
        await Promise.allSettled(
          unreadList.map(item => updateDoc(doc(db, 'notifications', item.id), { read: true }))
        );
      } catch (err) {
        console.warn('Could not mark all notifications as read in cloud:', err);
      }
    }
  };

  const createNotification = async (item: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>) => {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const fullItem: NotificationItem = {
      ...item,
      id: notifId,
      createdAt: new Date().toISOString(),
      read: false
    };

    if (user && item.userId === user.id) {
      setNotifications(prev => {
        const updated = [fullItem, ...prev];
        localStorage.setItem(`epsync_notifications_${user.id}`, JSON.stringify(updated));
        localStorage.setItem(`showtime_notifications_${user.id}`, JSON.stringify(updated));
        return updated;
      });
    }

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'notifications', notifId), fullItem);
      } catch (err) {
        console.warn('Could not create notification in cloud:', err);
      }
    }
  };

  const visibleNotifications = useMemo(() => {
    return notifications.filter(n => !(n.senderId && blockedUsers.includes(n.senderId)));
  }, [notifications, blockedUsers]);

  const unreadCount = useMemo(() => {
    return visibleNotifications.filter(n => {
      if (n.read) return false;
      if (n.senderId && mutedUsers.includes(n.senderId) && n.type === 'direct_message') return false;
      return true;
    }).length;
  }, [visibleNotifications, mutedUsers]);

  return (
    <NotificationContext.Provider
      value={{
        notifications: visibleNotifications,
        unreadCount,
        loading,
        reminders,
        browserNotificationPermission,
        markAsRead,
        markAllAsRead,
        createNotification,
        refreshNotifications,
        isReminderActive,
        toggleEpisodeReminder,
        removeEpisodeReminder,
        requestNotificationPermission,
        checkReleasesAndReminders
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

