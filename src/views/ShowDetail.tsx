import React, { useState, useEffect } from 'react';
import { fetchMediaDetails, getImageUrl, fetchSeasonEpisodes, fetchWatchProviders } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { useAuth } from '../context/AuthContext.js';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc, 
  getDocs, 
  query, 
  where,
  orderBy,
  limit
} from 'firebase/firestore/lite';
import { ChevronLeft, CheckCircle, Heart, Calendar, Clock, Plus, Send, Bell } from 'lucide-react';
import { pushToast } from '../services/toast.js';
import { trackEvent } from '../services/telemetry.js';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

interface ShowDetailProps {
  mediaId: string;
  mediaType: 'show' | 'movie';
  onBack: () => void;
  initialSeasonNum?: number;
  initialEpisodeNum?: number;
}

export const ShowDetail: React.FC<ShowDetailProps> = ({ 
  mediaId, 
  mediaType, 
  onBack,
  initialSeasonNum,
  initialEpisodeNum
}) => {
  const { user } = useAuth();
  const { 
    watchedEpisodes, 
    watchedMovies, 
    lists, 
    followedShows,
    toggleWatchEpisode, 
    toggleWatchMovie, 
    toggleFavoriteMovie,
    addToList,
    removeFromList,
    createList,
    toggleFollowShow,
    watchAllEpisodesOfShow,
    watchAllEpisodesOfSeason
  } = useTracking();

  const [media, setMedia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [expandedEpisodeNum, setExpandedEpisodeNum] = useState<number | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'episodes' | 'community'>('episodes');
  const [isCommentSpoiler, setIsCommentSpoiler] = useState(false);
  const [revealedCommentIds, setRevealedCommentIds] = useState<string[]>([]);
  const [activeChatTab, setActiveChatTab] = useState<'discussion' | 'livechat'>('discussion');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessageText, setNewChatMessageText] = useState('');
  const [watchProviders, setWatchProviders] = useState<any[]>([]);
  
  const handleTabChange = (tab: 'episodes' | 'community') => {
    setActiveSubTab(tab);
    setExpandedEpisodeNum(null);
  };
  
  // Custom List management state
  const [showListDropdown, setShowListDropdown] = useState(false);

  // Comments and Reactions State
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [reactions, setReactions] = useState<any>({ counts: {}, total: 0, userReactionType: null });

  const loadMediaData = async () => {
    setLoading(true);
    setLoadError(null);
    setMedia(null);
    try {
      const data = await fetchMediaDetails(mediaId, mediaType);
      if (!data) {
        setLoadError('Série/filme não encontrado. Verifique se a chave TMDB está configurada corretamente.');
        return;
      }
      setMedia(data);
      if (data.tmdbId) {
        const providers = await fetchWatchProviders(mediaType, data.tmdbId);
        setWatchProviders(providers);
      } else {
        setWatchProviders([]);
      }
      if (data.seasons && data.seasons.length > 0) {
        const hasInitialSeason = data.seasons.some((s: any) => s.seasonNumber === initialSeasonNum);
        setSelectedSeasonNum(hasInitialSeason && initialSeasonNum !== undefined ? initialSeasonNum : data.seasons[0].seasonNumber);
      }
    } catch (e: any) {
      console.error('loadMediaData error:', e);
      setLoadError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMediaData();
    if (initialEpisodeNum !== undefined) {
      setExpandedEpisodeNum(initialEpisodeNum);
    } else {
      setExpandedEpisodeNum(null);
    }
  }, [mediaId, mediaType, initialSeasonNum, initialEpisodeNum]);

  // Load season episodes dynamically on selection change
  useEffect(() => {
    if (!media || mediaType !== 'show') return;
    if (!media.seasons || media.seasons.length === 0) return;

    const activeSeason = media.seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum);
    
    // Skip if episodes are already fetched and cached in state
    if (activeSeason && activeSeason.episodes && activeSeason.episodes.length > 0) {
      return;
    }

    // If season doesn't exist in our data, don't try to fetch
    if (!activeSeason) return;

    const loadEpisodes = async () => {
      setEpisodesLoading(true);
      try {
        const eps = await fetchSeasonEpisodes(media.id, selectedSeasonNum);
        setMedia((prev: any) => {
          if (!prev || !prev.seasons) return prev;
          const updatedSeasons = prev.seasons.map((s: any) => {
            if (s.seasonNumber === selectedSeasonNum) {
              return { ...s, episodes: eps, episodeCount: eps.length };
            }
            return s;
          });
          return { ...prev, seasons: updatedSeasons };
        });
      } catch (err) {
        console.error("Failed to load season episodes dynamically", err);
      } finally {
        setEpisodesLoading(false);
      }
    };

    loadEpisodes();
  }, [selectedSeasonNum, media?.id]);

  // Load comments & reactions for the currently selected item
  // If an episode is expanded, we can load episode comments. Otherwise, show/movie comments.
  const loadCommentsAndReactions = async () => {
    if (!media) return;
    
    const isEp = expandedEpisodeNum !== null;
    const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
    
    const colCommentsName = 'comments';
    const colReactionsName = 'reactions';

    if (isFirebaseEnabled && db) {
      try {
        let qCommentsSimple;
        if (isEp) {
          qCommentsSimple = query(collection(db, colCommentsName), where('episodeId', '==', epId));
        } else if (mediaType === 'show') {
          qCommentsSimple = query(collection(db, colCommentsName), where('showId', '==', media.id));
        } else {
          qCommentsSimple = query(collection(db, colCommentsName), where('movieId', '==', media.id));
        }

        const snapComments = await getDocs(qCommentsSimple);
        let commentsData = snapComments.docs.map(d => d.data() as any);
        
        if (mediaType === 'show' && !isEp) {
          commentsData = commentsData.filter((c: any) => !c.episodeId);
        }
        
        commentsData.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setComments(commentsData);

        let qReactionsSimple;
        if (isEp) {
          qReactionsSimple = query(collection(db, colReactionsName), where('episodeId', '==', epId));
        } else if (mediaType === 'show') {
          qReactionsSimple = query(collection(db, colReactionsName), where('showId', '==', media.id));
        } else {
          qReactionsSimple = query(collection(db, colReactionsName), where('movieId', '==', media.id));
        }

        const snapReactions = await getDocs(qReactionsSimple);
        let reactionsData = snapReactions.docs.map(d => d.data() as any);

        if (mediaType === 'show' && !isEp) {
          reactionsData = reactionsData.filter((r: any) => !r.episodeId);
        }

        const counts: Record<string, number> = {};
        reactionsData.forEach((r: any) => {
          counts[r.type] = (counts[r.type] || 0) + 1;
        });

        const userReaction = user ? (reactionsData.find((r: any) => r.userId === user.id) as any) : null;

        setReactions({
          counts,
          total: reactionsData.length,
          userReactionType: userReaction ? userReaction.type : null,
          userReactionId: userReaction ? userReaction.id : null
        });
      } catch (e) {
        console.error('Error loading comments/reactions from Firestore:', e);
      }
    } else {
      const storageKey = isEp ? `comments_${epId}` : (mediaType === 'show' ? `comments_show_${media.id}` : `comments_movie_${media.id}`);
      const savedComments = localStorage.getItem(storageKey);
      setComments(savedComments ? JSON.parse(savedComments) : []);

      const rxKey = isEp ? `reactions_${epId}` : (mediaType === 'show' ? `reactions_show_${media.id}` : `reactions_movie_${media.id}`);
      const savedReactions = localStorage.getItem(rxKey);
      const rxList = savedReactions ? JSON.parse(savedReactions) : [];

      const counts: Record<string, number> = {};
      rxList.forEach((r: any) => {
        counts[r.type] = (counts[r.type] || 0) + 1;
      });

      const userRx = user ? rxList.find((r: any) => r.userId === user.id) : null;

      setReactions({
        counts,
        total: rxList.length,
        userReactionType: userRx ? userRx.type : null,
        userReactionId: userRx ? userRx.id : null
      });
    }
  };

  useEffect(() => {
    if (media) {
      loadCommentsAndReactions();
    }
  }, [media, selectedSeasonNum, expandedEpisodeNum]);



  // Check watch statuses
  const isMovieWatched = (watchedMovies || []).some(m => m.movieId === media?.id || m.movieId === mediaId);
  const isMovieFavorite = (watchedMovies || []).find(m => m.movieId === media?.id || m.movieId === mediaId)?.isFavorite || false;

  const isEpisodeWatched = (epId: string) => (watchedEpisodes || []).some(e => e && e.episodeId === epId);
  const safeFollowedShows = followedShows || [];
  const safeLists = lists || [];

  // Compute season stats
  const activeSeason = media?.seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum);
  const seasonEpisodes = activeSeason?.episodes || [];
  const watchedInSeason = seasonEpisodes.filter((ep: any) => {
    const epId = `ep_${media?.id}_${selectedSeasonNum}_${ep.episodeNumber}`;
    return isEpisodeWatched(epId);
  }).length;
  const isSeasonComplete = seasonEpisodes.length > 0 && watchedInSeason === seasonEpisodes.length;

  // Toggle list membership

  const handleQuickCreateList = async () => {
    const listName = window.prompt("Digite o nome da nova lista:");
    if (!listName || !listName.trim()) return;
    await createList(listName, "Lista criada rapidamente", 'mixed');
    trackEvent('quick_list_created', { listNameLength: listName.trim().length });
  };

  const handleListToggle = async (listId: string) => {
    // Add or remove from custom list
    // Normally we'd check if it's already in the list, for simplicity we just attempt to add.
    // If it fails (already in list), we can offer a way to remove it in the backend lists view.
    const success = await addToList(listId, mediaType, media.id, media);
    if (success) {
      pushToast('success', 'Adicionado com sucesso à lista.');
      trackEvent('detail_list_item_added', { listId, mediaType, mediaId: media.id });
    } else {
      // Toggle remove
      await removeFromList(listId, media.id);
      pushToast('info', 'Removido da lista.');
      trackEvent('detail_list_item_removed', { listId, mediaType, mediaId: media.id });
    }
    setShowListDropdown(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !user) return;

    const isEp = expandedEpisodeNum !== null;
    const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;

    const commentId = 'c_' + generateId();
    const commentData = {
      id: commentId,
      userId: user.id,
      username: user.username,
      content: newCommentText,
      createdAt: new Date().toISOString(),
      episodeId: epId || null,
      showId: mediaType === 'show' ? media.id : null,
      movieId: mediaType === 'movie' ? media.id : null,
      isSpoiler: isCommentSpoiler
    };

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'comments', commentId), commentData);
        setNewCommentText('');
        setIsCommentSpoiler(false);
        await loadCommentsAndReactions();
        pushToast('success', 'Comentário publicado.');
        trackEvent('comment_posted', { mediaType, hasSpoiler: isCommentSpoiler, isEpisodeComment: Boolean(epId) });
      } catch (err) {
        console.error('Error posting Firestore comment:', err);
        pushToast('error', 'Erro ao publicar comentário.');
      }
    } else {
      const storageKey = isEp ? `comments_${epId}` : (mediaType === 'show' ? `comments_show_${media.id}` : `comments_movie_${media.id}`);
      const savedComments = localStorage.getItem(storageKey);
      const commentsList = savedComments ? JSON.parse(savedComments) : [];
      commentsList.unshift(commentData);
      localStorage.setItem(storageKey, JSON.stringify(commentsList));
      
      setNewCommentText('');
      setIsCommentSpoiler(false);
      loadCommentsAndReactions();
      pushToast('success', 'Comentário salvo localmente.');
      trackEvent('comment_posted_offline', { mediaType, hasSpoiler: isCommentSpoiler, isEpisodeComment: Boolean(epId) });
    }
  };

  const handleCommentReaction = async (commentId: string, reactionType: string) => {
    if (!user) return;

    const commentIndex = comments.findIndex(c => c.id === commentId);
    if (commentIndex === -1) return;

    const targetComment = comments[commentIndex];
    const currentReactions = targetComment.reactions || { like: [], haha: [], wow: [], sad: [], love: [] };

    const keys = ['like', 'haha', 'wow', 'sad', 'love'];
    keys.forEach(k => {
      if (!Array.isArray(currentReactions[k])) currentReactions[k] = [];
    });

    const userList = currentReactions[reactionType] as string[];
    const alreadyReacted = userList.includes(user.id);

    const updatedReactions = { ...currentReactions };
    if (alreadyReacted) {
      updatedReactions[reactionType] = userList.filter(uid => uid !== user.id);
    } else {
      updatedReactions[reactionType] = [...userList, user.id];
    }

    const updatedComments = [...comments];
    updatedComments[commentIndex] = { ...targetComment, reactions: updatedReactions };
    setComments(updatedComments);

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'comments', commentId), {
          ...targetComment,
          reactions: updatedReactions
        });
      } catch (err) {
        console.error('Error updating comment reaction in Firestore:', err);
        const rollbackComments = [...comments];
        rollbackComments[commentIndex] = targetComment;
        setComments(rollbackComments);
      }
    } else {
      const isEp = expandedEpisodeNum !== null;
      const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
      const storageKey = isEp ? `comments_${epId}` : (mediaType === 'show' ? `comments_show_${media.id}` : `comments_movie_${media.id}`);
      localStorage.setItem(storageKey, JSON.stringify(updatedComments));
    }
  };

  // Live Chat polling listener (Firestore Lite)
  useEffect(() => {
    if (!media || expandedEpisodeNum === null || activeChatTab !== 'livechat') {
      setChatMessages([]);
      return;
    }

    const epId = `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}`;

    if (isFirebaseEnabled && db) {
      const q = query(
        collection(db, 'live_chats'),
        where('episodeId', '==', epId),
        orderBy('createdAt', 'asc'),
        limit(50)
      );

      let mounted = true;

      const loadMessages = async () => {
        try {
          const snapshot = await getDocs(q);
          if (!mounted) return;

          const msgs = snapshot.docs.map((snap) => snap.data() as any);
          setChatMessages(msgs);

          setTimeout(() => {
            const chatBox = document.getElementById('live-chat-messages-container');
            if (chatBox) {
              chatBox.scrollTop = chatBox.scrollHeight;
            }
          }, 100);
        } catch (error) {
          console.error('Live chat polling error:', error);
        }
      };

      loadMessages();
      const interval = window.setInterval(loadMessages, 4000);

      return () => {
        mounted = false;
        window.clearInterval(interval);
      };
    } else {
      const key = `chat_${epId}`;
      const saved = localStorage.getItem(key);
      const initialMsgs = saved ? JSON.parse(saved) : [
        { id: 'm1', username: 'System', text: 'Bem-vindo ao Chat ao Vivo do Episódio! (Modo de Demonstração)', createdAt: new Date(Date.now() - 60000).toISOString(), userId: 'sys' }
      ];
      setChatMessages(initialMsgs);

      const interval = setInterval(() => {
        const mockUsers = ['Alice', 'Bob', 'Carlos', 'Mariana'];
        const mockTexts = [
          'Esse episódio foi absurdo!',
          'Que final de temporada de arrepiar!',
          'Vocês viram aquele easter egg no começo?',
          'Será que vai ter continuação?',
          'A trilha sonora estava sensacional!',
          'Não acredito que fizeram isso com ele 😭'
        ];
        const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];
        const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
        
        const newMsg = {
          id: 'mock_' + generateId(),
          username: randomUser,
          text: randomText,
          createdAt: new Date().toISOString(),
          userId: 'mock_' + randomUser
        };

        setChatMessages(prev => {
          const updated = [...prev, newMsg];
          localStorage.setItem(key, JSON.stringify(updated));
          return updated;
        });

        setTimeout(() => {
          const chatBox = document.getElementById('live-chat-messages-container');
          if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [media, selectedSeasonNum, expandedEpisodeNum, activeChatTab]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatMessageText.trim() || !user || !media || expandedEpisodeNum === null) return;

    const epId = `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}`;
    const messageId = 'm_' + generateId();
    const messageData = {
      id: messageId,
      userId: user.id,
      username: user.username,
      text: newChatMessageText.trim(),
      createdAt: new Date().toISOString(),
      episodeId: epId
    };

    setNewChatMessageText('');

    if (isFirebaseEnabled && db) {
      try {
        await setDoc(doc(db, 'live_chats', messageId), messageData);
      } catch (err) {
        console.error('Error sending live chat message:', err);
      }
    } else {
      const key = `chat_${epId}`;
      const saved = localStorage.getItem(key);
      const msgs = saved ? JSON.parse(saved) : [];
      const updated = [...msgs, messageData];
      localStorage.setItem(key, JSON.stringify(updated));
      setChatMessages(updated);

      setTimeout(() => {
        const chatBox = document.getElementById('live-chat-messages-container');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 100);
    }
  };

  const handlePostReaction = async (reactionType: string) => {
    if (!user) return;

    const isEp = expandedEpisodeNum !== null;
    const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
    
    const reactionKey = isEp 
      ? `${user.id}_${epId}` 
      : (mediaType === 'show' ? `${user.id}_show_${media.id}` : `${user.id}_movie_${media.id}`);

    if (isFirebaseEnabled && db) {
      try {
        const docRef = doc(db, 'reactions', reactionKey);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().type === reactionType) {
          await deleteDoc(docRef);
        } else {
          await setDoc(docRef, {
            id: 'r_' + generateId(),
            userId: user.id,
            type: reactionType,
            createdAt: new Date().toISOString(),
            episodeId: epId || null,
            showId: mediaType === 'show' ? media.id : null,
            movieId: mediaType === 'movie' ? media.id : null
          });
        }
        await loadCommentsAndReactions();
      } catch (err) {
        console.error('Error saving reaction in Firestore:', err);
      }
    } else {
      const rxKey = isEp ? `reactions_${epId}` : (mediaType === 'show' ? `reactions_show_${media.id}` : `reactions_movie_${media.id}`);
      const savedReactions = localStorage.getItem(rxKey);
      let rxList = savedReactions ? JSON.parse(savedReactions) : [];

      const existingIndex = rxList.findIndex((r: any) => r.userId === user.id);
      if (existingIndex > -1) {
        if (rxList[existingIndex].type === reactionType) {
          rxList.splice(existingIndex, 1);
        } else {
          rxList[existingIndex].type = reactionType;
          rxList[existingIndex].createdAt = new Date().toISOString();
        }
      } else {
        rxList.push({
          id: 'r_' + generateId(),
          userId: user.id,
          type: reactionType,
          createdAt: new Date().toISOString(),
          episodeId: epId || null,
          showId: mediaType === 'show' ? media.id : null,
          movieId: mediaType === 'movie' ? media.id : null
        });
      }
      localStorage.setItem(rxKey, JSON.stringify(rxList));
      loadCommentsAndReactions();
    }
  };

  const handleEpisodeClick = (epNum: number) => {
    if (expandedEpisodeNum === epNum) {
      setExpandedEpisodeNum(null);
    } else {
      setExpandedEpisodeNum(epNum);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{
          width: '48px', height: '48px',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 20px'
        }} />
        <p style={{ fontSize: '16px' }}>Carregando dados da mídia...</p>
      </div>
    );
  }

  if (loadError || !media) {
    return (
      <div style={{ padding: '60px', textAlign: 'center' }}>
        <div style={{
          fontSize: '48px', marginBottom: '16px'
        }}>⚠️</div>
        <h3 style={{ fontSize: '20px', marginBottom: '12px', color: 'var(--text-primary)' }}>
          {loadError || 'Mídia não encontrada'}
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '440px', margin: '0 auto 24px' }}>
          Isso pode acontecer quando a série não existe no catálogo local e a chave TMDB não está configurada, ou houve uma falha temporária de rede.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button onClick={loadMediaData} className="btn-primary">
            🔄 Tentar Novamente
          </button>
          <button onClick={onBack} className="btn-secondary">
            ← Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="show-detail-view animate-fade-in" style={{ paddingBottom: '60px' }}>
      
      {/* Back Button */}
      <button 
        onClick={onBack} 
        className="btn-secondary" 
        style={{ marginBottom: '24px', padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}
      >
        <ChevronLeft size={16} />
        Voltar
      </button>

      {/* Edge-to-Edge Backdrop Banner Panel */}
      <div 
        className="backdrop-banner" 
        style={{ 
          height: 'clamp(320px, 42vw, 500px)', 
          width: '100%',
          marginLeft: '0',
          marginRight: '0',
          marginTop: '0',
          backgroundImage: `linear-gradient(to top, var(--bg-dark) 0%, rgba(7, 7, 10, 0.6) 50%, rgba(0, 0, 0, 0.2) 100%), url(${getImageUrl(media.backdropPath, 'original')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundRepeat: 'no-repeat',
          display: 'flex',
          alignItems: 'end',
          padding: '40px 4%',
          marginBottom: '30px',
          position: 'relative',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden'
        }}
      >
        {/* Poster & Main Header info overlap */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'end', width: '100%', maxWidth: '1200px', margin: '0 auto', flexWrap: 'wrap' }} className="header-details">
          <img 
            src={getImageUrl(media.posterPath)} 
            alt={media.title}
            className="show-poster-image"
            style={{ width: 'clamp(120px, 14vw, 180px)', aspectRatio: '2 / 3', height: 'auto', objectFit: 'contain', background: 'rgba(0,0,0,0.22)', borderRadius: 'var(--radius-md)', boxShadow: '0 12px 30px rgba(0,0,0,0.6)', border: '2px solid rgba(255,255,255,0.1)' }}
          />
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h1 className="detail-title" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px, 4vw, 44px)', marginBottom: '8px', lineHeight: '1.1', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>{media.title}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {media.genres?.map((g: string) => (
                <span key={g} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontWeight: '600', backdropFilter: 'blur(4px)' }}>
                  {g}
                </span>
              ))}
            </div>
            <p className="detail-overview" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', maxWidth: '800px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.6', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
              {media.overview || "Sem sinopse disponível."}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }} className="detail-grid">
        
        {/* Left Column: Actions / Seasons & Episodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Action Row */}
          <div className="st-panel detail-action-panel" style={{ padding: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
            {mediaType === 'movie' ? (
              <>
                <button 
                  onClick={() => toggleWatchMovie(media.id, media)}
                  className="st-btn-primary"
                  style={{ background: isMovieWatched ? 'var(--accent)' : '' }}
                >
                  <CheckCircle size={20} />
                  {isMovieWatched ? 'Assistido' : 'Marcar como Assistido'}
                </button>
                <button 
                  onClick={() => toggleFavoriteMovie(media.id, media)}
                  className="st-btn-secondary"
                  style={{ color: isMovieFavorite ? 'var(--secondary)' : 'var(--text-primary)', borderColor: isMovieFavorite ? 'var(--secondary)' : 'var(--border-color)' }}
                >
                  <Heart size={20} fill={isMovieFavorite ? 'var(--secondary)' : 'transparent'} />
                  {isMovieFavorite ? 'Favorito' : 'Adicionar aos Favoritos'}
                </button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: '150px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Status da Série</div>
                  <div style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{media.status || 'Ativa'}</div>
                </div>
                <button 
                  onClick={() => toggleFollowShow(media.id, media)}
                  className="st-btn-secondary"
                  style={{ 
                    color: safeFollowedShows.includes(media.id) ? 'var(--primary)' : 'var(--text-primary)', 
                    borderColor: safeFollowedShows.includes(media.id) ? 'var(--primary)' : 'var(--border-color)',
                  }}
                >
                  <Bell size={20} fill={safeFollowedShows.includes(media.id) ? 'var(--primary)' : 'transparent'} />
                  {safeFollowedShows.includes(media.id) ? 'Seguindo' : 'Seguir'}
                </button>
              </>
            )}

            {/* List Dropdown Toggle */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowListDropdown(!showListDropdown)}
                className="st-btn-secondary"
              >
                <Plus size={20} />
                Adicionar à Lista
              </button>
              {showListDropdown && (
                <div className="st-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 10, width: '220px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {safeLists.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Você não possui listas.</div>
                      <button 
                        onClick={handleQuickCreateList}
                        className="btn-primary"
                        style={{ width: '100%', fontSize: '12px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                      >
                        Criar Nova Lista
                      </button>
                    </div>
                  ) : (
                    safeLists.map(list => (
                      <button 
                        key={list.id} 
                        onClick={() => handleListToggle(list.id)}
                        style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '8px 12px', fontSize: '13px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background var(--transition-fast)' }}
                        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {list.name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sub-Tabs Selector (For Shows only) */}
          {mediaType === 'show' && (
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => handleTabChange('episodes')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeSubTab === 'episodes' ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '10px 16px',
                  color: activeSubTab === 'episodes' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all var(--transition-fast)'
                }}
              >
                📅 Episódios
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('community')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: activeSubTab === 'community' ? '2px solid var(--primary)' : '2px solid transparent',
                  padding: '10px 16px',
                  color: activeSubTab === 'community' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all var(--transition-fast)'
                }}
              >
                💬 Mural da Série
              </button>
            </div>
          )}

          {/* Episode List (For Shows) */}
          {mediaType === 'show' && activeSubTab === 'episodes' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-display)' }}>Episódios</h3>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => {
                      watchAllEpisodesOfShow(media);
                      pushToast('info', 'Marcando episódios da série...');
                      trackEvent('mark_show_as_watched_clicked', { showId: media.id });
                    }}
                    className="st-btn-secondary"
                    style={{ fontSize: '12px', padding: '8px 12px', whiteSpace: 'nowrap' }}
                  >
                    Marcar Série Completa
                  </button>

                  {/* Seasons Dropdown Selector */}
                  <div style={{ position: 'relative', minWidth: '160px' }}>
                  <select 
                    value={selectedSeasonNum} 
                    onChange={(e) => { setSelectedSeasonNum(Number(e.target.value)); setExpandedEpisodeNum(null); }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '8px 36px 8px 16px',
                      fontSize: '14px',
                      borderRadius: 'var(--radius-full)',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none',
                      width: '100%',
                      fontWeight: 'bold',
                      fontFamily: 'inherit',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  >
                    {media.seasons?.map((s: any) => (
                      <option key={s.seasonNumber} value={s.seasonNumber} style={{ background: '#18181b', color: 'var(--text-primary)' }}>
                        Temporada {s.seasonNumber}
                      </option>
                    ))}
                  </select>
                  <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

              {/* Season Progress Bar */}
              <div className="st-panel" style={{ padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {isSeasonComplete ? (
                    <span style={{ display: 'inline-flex', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 'bold' }}>
                      Temporada Completa!
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Progresso: <strong style={{ color: 'var(--text-primary)' }}>{watchedInSeason} / {seasonEpisodes.length}</strong>
                      </span>
                      <button 
                        onClick={() => watchAllEpisodesOfSeason(media, seasonEpisodes, selectedSeasonNum)}
                        className="st-btn-primary glow-hover"
                        style={{ padding: '6px 14px', fontSize: '12px', borderRadius: 'var(--radius-full)', cursor: 'pointer', height: 'fit-content', boxShadow: 'none' }}
                      >
                        Marcar Temporada como Assistida
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', height: '8px', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginLeft: '20px' }}>
                  <div style={{ width: `${(watchedInSeason / (seasonEpisodes.length || 1)) * 100}%`, background: 'var(--primary)', height: '100%', transition: 'width 0.4s ease' }}></div>
                </div>
              </div>

              {/* Episodes Accordion */}
              {episodesLoading ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                  <div className="spinner" style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.05)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                  <span>Carregando episódios da temporada...</span>
                </div>
              ) : seasonEpisodes.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Nenhum episódio cadastrado para esta temporada.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {seasonEpisodes.map((ep: any) => {
                    const epId = `ep_${media.id}_${selectedSeasonNum}_${ep.episodeNumber}`;
                    const watched = isEpisodeWatched(epId);
                    const isExpanded = expandedEpisodeNum === ep.episodeNumber;

                    return (
                      <div 
                        key={ep.episodeNumber} 
                        className="st-card" 
                        style={{ borderLeft: watched ? '4px solid var(--accent)' : '1px solid var(--border-color)', overflow: 'hidden' }}
                      >
                        {/* Accordion Header */}
                        <div 
                          style={{ display: 'flex', padding: '14px 20px', alignItems: 'center', gap: '16px', cursor: 'pointer' }}
                          onClick={() => handleEpisodeClick(ep.episodeNumber)}
                        >
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              await toggleWatchEpisode(epId, media, ep);
                            }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: watched ? 'var(--accent)' : 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
                          >
                            <CheckCircle size={22} fill={watched ? 'rgba(16, 185, 129, 0.1)' : 'transparent'} />
                          </button>
                          
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="episode-header-info" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                              <h4 style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                Ep {ep.episodeNumber.toString().padStart(2, '0')} - {ep.title}
                              </h4>
                              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Calendar size={10} /> {ep.airDate}</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {ep.duration} min</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Accordion Expand Body */}
                        {isExpanded && (
                          <div style={{ padding: '0 20px 20px 58px', borderTop: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.15)' }} className="episode-expand-body animate-fade-in">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '12px', marginBottom: '18px' }}>
                              {ep.overview || "Sem sinopse disponível."}
                            </p>

                            {/* Accordion Comments & Reactions section */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                              
                              {/* Sub-Tabs selector inside Episode expanded accordion */}
                              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '14px' }}>
                                <button
                                  type="button"
                                  onClick={() => setActiveChatTab('discussion')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeChatTab === 'discussion' ? '2px solid var(--primary)' : '2px solid transparent',
                                    padding: '6px 12px',
                                    color: activeChatTab === 'discussion' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all var(--transition-fast)'
                                  }}
                                >
                                  💬 Discussão ({comments.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setActiveChatTab('livechat')}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: activeChatTab === 'livechat' ? '2px solid var(--primary)' : '2px solid transparent',
                                    padding: '6px 12px',
                                    color: activeChatTab === 'livechat' ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontSize: '12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    transition: 'all var(--transition-fast)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--error)' }}></span>
                                  🔴 Chat ao Vivo
                                </button>
                              </div>

                              {activeChatTab === 'discussion' ? (
                                <>
                                  {/* Reactions Row */}
                                  <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                    {['like', 'love', 'wow', 'sad'].map(type => {
                                      const emo: Record<string, string> = { like: '👍', love: '❤️', wow: '😮', sad: '😢' };
                                      const isActive = reactions.userReactionType === type;
                                      return (
                                        <button 
                                          key={type}
                                          type="button"
                                          onClick={() => handlePostReaction(type)}
                                          style={{ background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', display: 'flex', gap: '6px', color: isActive ? 'white' : 'var(--text-primary)', transition: 'all var(--transition-fast)' }}
                                        >
                                          <span>{emo[type]}</span>
                                          <span>{reactions.counts[type] || 0}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Comments List */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                                    {comments.length === 0 ? (
                                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Nenhum comentário. Seja o primeiro a comentar!</div>
                                    ) : (
                                      comments.map(c => (
                                        <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                                            <span style={{ color: 'var(--primary)' }}>@{c.username}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                                          </div>
                                          {c.isSpoiler && !revealedCommentIds.includes(c.id) ? (
                                            <div 
                                              className="spoiler-hidden" 
                                              onClick={() => setRevealedCommentIds(prev => [...prev, c.id])}
                                              style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}
                                            >
                                              <span className="spoiler-badge">⚠️ SPOILER</span>
                                              <span style={{ color: 'var(--text-secondary)' }}>Clique para revelar o comentário</span>
                                            </div>
                                          ) : (
                                            <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                                          )}

                                          {/* Comment Reactions */}
                                          <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                                            {['like', 'haha', 'wow', 'sad', 'love'].map(type => {
                                              const emos: Record<string, string> = { like: '👍', haha: '😂', wow: '😮', sad: '😢', love: '❤️' };
                                              const rxList = c.reactions?.[type] || [];
                                              const userReacted = user ? rxList.includes(user.id) : false;
                                              return (
                                                <button
                                                  key={type}
                                                  type="button"
                                                  onClick={() => handleCommentReaction(c.id, type)}
                                                  style={{ 
                                                    background: userReacted ? 'rgba(99, 102, 241, 0.15)' : 'transparent', 
                                                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                                                    borderRadius: 'var(--radius-sm)', 
                                                    padding: '2px 6px', 
                                                    fontSize: '11px', 
                                                    cursor: 'pointer', 
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    gap: '4px', 
                                                    color: userReacted ? 'var(--primary)' : 'var(--text-secondary)',
                                                    outline: 'none',
                                                    transition: 'all var(--transition-fast)'
                                                  }}
                                                >
                                                  <span>{emos[type]}</span>
                                                  <span>{rxList.length}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>

                                  {/* Comment Form */}
                                  <form onSubmit={handlePostComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                      <input 
                                        type="text" 
                                        placeholder="Escreva um comentário..."
                                        value={newCommentText}
                                        onChange={e => setNewCommentText(e.target.value)}
                                        style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none' }}
                                      />
                                      <button type="submit" className="btn-primary" style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)' }}>
                                        <Send size={12} />
                                      </button>
                                    </div>
                                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                                      <input 
                                        type="checkbox" 
                                        checked={isCommentSpoiler}
                                        onChange={e => setIsCommentSpoiler(e.target.checked)}
                                        style={{ accentColor: 'var(--primary)' }}
                                      />
                                      <span>⚠️ Contém Spoiler</span>
                                    </label>
                                  </form>
                                </>
                              ) : (
                                /* Live Chat Tab Content */
                                <div className="live-chat-container">
                                  <div className="live-chat-messages" id="live-chat-messages-container">
                                    {chatMessages.length === 0 ? (
                                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', fontStyle: 'italic', margin: 'auto' }}>
                                        Nenhuma mensagem no chat. Envie a primeira mensagem!
                                      </div>
                                    ) : (
                                      chatMessages.map(msg => {
                                        const isSelf = user && msg.userId === user.id;
                                        return (
                                          <div key={msg.id} className={`live-chat-msg ${isSelf ? 'self' : ''}`}>
                                            <div className="live-chat-header">
                                              <span className="live-chat-user">{isSelf ? 'Você' : `@${msg.username}`}</span>
                                              <span className="live-chat-time">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="live-chat-body">{msg.text}</div>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>

                                  <form onSubmit={handleSendChatMessage} className="live-chat-input-bar">
                                    <input 
                                      type="text"
                                      placeholder="Envie uma mensagem ao vivo..."
                                      value={newChatMessageText}
                                      onChange={e => setNewChatMessageText(e.target.value)}
                                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none' }}
                                    />
                                    <button type="submit" className="btn-primary" style={{ padding: '8px 14px', borderRadius: 'var(--radius-sm)' }}>
                                      <Send size={12} />
                                    </button>
                                  </form>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* General Series Mural Community Feed Tab */}
          {mediaType === 'show' && activeSubTab === 'community' && (
            <section className="st-panel animate-fade-in" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '8px' }}>Mural da Comunidade</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: '1.4' }}>
                Compartilhe teorias, memes, fanart e converse sobre a série como um todo com outros fãs!
              </p>

              {/* Comments/Posts List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {comments.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum post no mural ainda. Comece a conversa!</div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--primary)' }}>@{c.username}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      {c.isSpoiler && !revealedCommentIds.includes(c.id) ? (
                        <div 
                          className="spoiler-hidden" 
                          onClick={() => setRevealedCommentIds(prev => [...prev, c.id])}
                          style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                          <span className="spoiler-badge">⚠️ SPOILER</span>
                          <span style={{ color: 'var(--text-secondary)' }}>Clique para revelar o comentário</span>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                      )}

                      {/* Comment Reactions */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {['like', 'haha', 'wow', 'sad', 'love'].map(type => {
                          const emos: Record<string, string> = { like: '👍', haha: '😂', wow: '😮', sad: '😢', love: '❤️' };
                          const rxList = c.reactions?.[type] || [];
                          const userReacted = user ? rxList.includes(user.id) : false;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleCommentReaction(c.id, type)}
                              style={{ 
                                background: userReacted ? 'rgba(99, 102, 241, 0.15)' : 'transparent', 
                                border: '1px solid rgba(255, 255, 255, 0.05)', 
                                borderRadius: 'var(--radius-sm)', 
                                padding: '2px 6px', 
                                fontSize: '11px', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                color: userReacted ? 'var(--primary)' : 'var(--text-secondary)',
                                outline: 'none',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <span>{emos[type]}</span>
                              <span>{rxList.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Post Input Form */}
              <form onSubmit={handlePostComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Escreva algo para a comunidade..."
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '10px 18px' }}>
                    Publicar
                  </button>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                  <input 
                    type="checkbox" 
                    checked={isCommentSpoiler}
                    onChange={e => setIsCommentSpoiler(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>⚠️ Contém Spoiler</span>
                </label>
              </form>
            </section>
          )}

          {/* Movie Comments (if mediaType is movie) */}
          {mediaType === 'movie' && (
            <section className="st-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-display)', marginBottom: '16px' }}>Comentários e Reações</h3>
              
              {/* Movie Reactions */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['like', 'love', 'wow', 'sad'].map(type => {
                  const emo: Record<string, string> = { like: '👍', love: '❤️', wow: '😮', sad: '😢' };
                  const isActive = reactions.userReactionType === type;
                  return (
                    <button 
                      key={type}
                      onClick={() => handlePostReaction(type)}
                      style={{ background: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: '13px', cursor: 'pointer', display: 'flex', gap: '6px', color: isActive ? 'white' : 'var(--text-primary)', transition: 'all var(--transition-fast)' }}
                    >
                      <span>{emo[type]}</span>
                      <span>{reactions.counts[type] || 0}</span>
                    </button>
                  );
                })}
              </div>

              {/* Comments List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {comments.length === 0 ? (
                  <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum comentário. Compartilhe sua opinião sobre o filme!</div>
                ) : (
                  comments.map(c => (
                    <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--primary)' }}>@{c.username}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      {c.isSpoiler && !revealedCommentIds.includes(c.id) ? (
                        <div 
                          className="spoiler-hidden" 
                          onClick={() => setRevealedCommentIds(prev => [...prev, c.id])}
                          style={{ fontSize: '11px', display: 'flex', gap: '6px', alignItems: 'center' }}
                        >
                          <span className="spoiler-badge">⚠️ SPOILER</span>
                          <span style={{ color: 'var(--text-secondary)' }}>Clique para revelar o comentário</span>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{c.content}</div>
                      )}

                      {/* Comment Reactions */}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {['like', 'haha', 'wow', 'sad', 'love'].map(type => {
                          const emos: Record<string, string> = { like: '👍', haha: '😂', wow: '😮', sad: '😢', love: '❤️' };
                          const rxList = c.reactions?.[type] || [];
                          const userReacted = user ? rxList.includes(user.id) : false;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleCommentReaction(c.id, type)}
                              style={{ 
                                background: userReacted ? 'rgba(99, 102, 241, 0.15)' : 'transparent', 
                                border: '1px solid rgba(255, 255, 255, 0.05)', 
                                borderRadius: 'var(--radius-sm)', 
                                padding: '2px 6px', 
                                fontSize: '11px', 
                                cursor: 'pointer', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                color: userReacted ? 'var(--primary)' : 'var(--text-secondary)',
                                outline: 'none',
                                transition: 'all var(--transition-fast)'
                              }}
                            >
                              <span>{emos[type]}</span>
                              <span>{rxList.length}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
                              <form onSubmit={handlePostComment} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div className="comment-input-row" style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    placeholder="Escreva sua opinião..."
                    value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)}
                    style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                  />
                  <button type="submit" className="btn-primary" style={{ padding: '10px 18px' }}>
                    Comentar
                  </button>
                </div>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', cursor: 'pointer', width: 'fit-content' }}>
                  <input 
                    type="checkbox" 
                    checked={isCommentSpoiler}
                    onChange={e => setIsCommentSpoiler(e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }}
                  />
                  <span>⚠️ Contém Spoiler</span>
                </label>
              </form>
            </section>
          )}

        </div>

        {/* Right Column: Streaming and Info Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Availability (Watchmode style) */}
          <section className="st-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginBottom: '14px' }}>Onde Assistir</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {watchProviders.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  Sem provedores disponíveis para região BR no momento.
                </div>
              ) : (
                watchProviders.map((provider: any) => (
                  <div key={provider.provider_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : getImageUrl(null)}
                        alt={provider.provider_name}
                        style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                      <span>{provider.provider_name}</span>
                    </div>
                    <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '11px' }}>{provider.accessType}</span>
                  </div>
                ))
              )}

            </div>
          </section>

          {/* Quick Technical details */}
          <section className="st-panel" style={{ padding: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginBottom: '4px' }}>Ficha Técnica</h4>
            {media.firstAirDate && <div><strong>Lançamento:</strong> {new Date(media.firstAirDate).toLocaleDateString('pt-BR')}</div>}
            {media.releaseDate && <div><strong>Lançamento:</strong> {new Date(media.releaseDate).toLocaleDateString('pt-BR')}</div>}
            {media.rating > 0 && <div><strong>Nota TMDB:</strong> ⭐ {media.rating.toFixed(1)} / 10</div>}
            {media.duration && <div><strong>Duração:</strong> {media.duration} minutos</div>}
            {media.tvdbId && <div><strong>ID TVDB:</strong> {media.tvdbId}</div>}
            <div><strong>ID TMDB:</strong> {media.tmdbId}</div>
          </section>

        </div>

      </div>

      <style>{`
        @media (max-width: 1080px) {
          .detail-grid {
            grid-template-columns: 1fr !important;
            gap: 22px !important;
          }

          .detail-action-panel {
            gap: 12px !important;
          }
        }

        @media (max-width: 900px) {
          .backdrop-banner {
            height: clamp(300px, 52vw, 430px) !important;
            padding: 24px 18px !important;
            margin-bottom: 20px !important;
          }

          .header-details {
            gap: 14px !important;
          }

          .detail-overview {
            -webkit-line-clamp: 4 !important;
          }
        }

        @media (max-width: 800px) {
          .detail-grid {
            grid-template-columns: 1fr !important;
          }

          .header-details {
            align-items: flex-start !important;
          }

          .detail-title {
            line-height: 1.15 !important;
          }

          .episode-expand-body {
            padding: 0 14px 14px 14px !important;
          }

          .detail-action-panel > button,
          .detail-action-panel > div > button {
            width: 100%;
          }

          .detail-action-panel > div {
            width: 100%;
          }

          .detail-action-panel .st-panel {
            width: 100% !important;
          }
        }

        @media (max-width: 640px) {
          .backdrop-banner {
            height: auto !important;
            min-height: 290px !important;
            align-items: flex-end !important;
            padding: 18px 14px !important;
            background-size: contain !important;
            background-color: rgba(255, 255, 255, 0.02);
          }

          .header-details {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center;
          }

          .show-poster-image {
            width: min(56vw, 200px) !important;
          }

          .detail-overview {
            max-width: 100% !important;
            font-size: 13px !important;
            -webkit-line-clamp: 5 !important;
          }

          .episode-header-info {
            flex-direction: column !important;
            align-items: flex-start !important;
          }

          .comment-input-row {
            flex-direction: column !important;
          }

          .comment-input-row button {
            width: 100%;
          }
        }

        @media (max-width: 420px) {
          .backdrop-banner {
            min-height: 260px !important;
          }

          .detail-title {
            font-size: 24px !important;
          }
        }
      `}</style>
    </div>
  );
};
