import React, { useState, useEffect } from 'react';
import { fetchMediaDetails, getImageUrl, backendApi, fetchSeasonEpisodes } from '../services/api.js';
import { useTracking } from '../context/TrackingContext.js';
import { ChevronLeft, CheckCircle, Heart, Calendar, Clock, Plus, Send } from 'lucide-react';

interface ShowDetailProps {
  mediaId: string;
  mediaType: 'show' | 'movie';
  onBack: () => void;
}

export const ShowDetail: React.FC<ShowDetailProps> = ({ mediaId, mediaType, onBack }) => {
  const { 
    watchedEpisodes, 
    watchedMovies, 
    lists, 
    toggleWatchEpisode, 
    toggleWatchMovie, 
    toggleFavoriteMovie,
    addToList,
    removeFromList,
    watchAllEpisodesOfSeason
  } = useTracking();

  const [media, setMedia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [expandedEpisodeNum, setExpandedEpisodeNum] = useState<number | null>(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  
  // Custom List management state
  const [showListDropdown, setShowListDropdown] = useState(false);

  // Comments and Reactions State
  const [comments, setComments] = useState<any[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [reactions, setReactions] = useState<any>({ counts: {}, total: 0, userReactionType: null });

  const loadMediaData = async () => {
    setLoading(true);
    try {
      const data = await fetchMediaDetails(mediaId, mediaType);
      setMedia(data);
      if (data && data.seasons && data.seasons.length > 0) {
        setSelectedSeasonNum(data.seasons[0].seasonNumber);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMediaData();
  }, [mediaId, mediaType]);

  // Load season episodes dynamically on selection change
  useEffect(() => {
    if (!media || mediaType !== 'show') return;

    const activeSeason = media.seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum);
    
    // Skip if episodes are already fetched and cached in state
    if (activeSeason && activeSeason.episodes && activeSeason.episodes.length > 0) {
      return;
    }

    const loadEpisodes = async () => {
      setEpisodesLoading(true);
      try {
        const eps = await fetchSeasonEpisodes(media.id, selectedSeasonNum);
        setMedia((prev: any) => {
          if (!prev) return prev;
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
    try {
      const isEp = expandedEpisodeNum !== null;
      const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
      
      const queryParams = isEp 
        ? { episodeId: epId } 
        : (mediaType === 'show' ? { showId: media.id } : { movieId: media.id });

      const commentsRes = await backendApi.get('/api/comments', { params: queryParams });
      setComments(commentsRes.data || []);

      const reactionsRes = await backendApi.get('/api/reactions', { params: queryParams });
      setReactions(reactionsRes.data || { counts: {}, total: 0, userReactionType: null });
    } catch (e) {
      console.error('Error loading comments/reactions', e);
    }
  };

  useEffect(() => {
    if (media) {
      loadCommentsAndReactions();
    }
  }, [media, selectedSeasonNum, expandedEpisodeNum]);

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando dados da mídia...</div>;
  }

  if (!media) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p>Mídia não encontrada.</p>
        <button onClick={onBack} className="btn-secondary" style={{ marginTop: '20px' }}>Voltar</button>
      </div>
    );
  }

  // Check watch statuses
  const isMovieWatched = watchedMovies.some(m => m.movieId === media.id || m.movieId === mediaId);
  const isMovieFavorite = watchedMovies.find(m => m.movieId === media.id || m.movieId === mediaId)?.isFavorite || false;

  const isEpisodeWatched = (epId: string) => watchedEpisodes.some(e => e.episodeId === epId);

  // Compute season stats
  const activeSeason = media.seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum);
  const seasonEpisodes = activeSeason?.episodes || [];
  const watchedInSeason = seasonEpisodes.filter((ep: any) => {
    const epId = `ep_${media.id}_${selectedSeasonNum}_${ep.episodeNumber}`;
    return isEpisodeWatched(epId);
  }).length;
  const isSeasonComplete = seasonEpisodes.length > 0 && watchedInSeason === seasonEpisodes.length;

  // Toggle list membership

  const handleListToggle = async (listId: string) => {
    // Add or remove from custom list
    // Normally we'd check if it's already in the list, for simplicity we just attempt to add.
    // If it fails (already in list), we can offer a way to remove it in the backend lists view.
    const success = await addToList(listId, mediaType, media.id, media);
    if (success) {
      alert(`Adicionado com sucesso à lista!`);
    } else {
      // Toggle remove
      await removeFromList(listId, media.id);
      alert(`Removido da lista!`);
    }
    setShowListDropdown(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    try {
      const isEp = expandedEpisodeNum !== null;
      const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
      
      const payload: any = { content: newCommentText };
      if (isEp) {
        payload.episodeId = epId;
      } else if (mediaType === 'show') {
        payload.showId = media.id;
      } else {
        payload.movieId = media.id;
      }

      await backendApi.post('/api/comments', payload);
      setNewCommentText('');
      loadCommentsAndReactions();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostReaction = async (reactionType: string) => {
    try {
      const isEp = expandedEpisodeNum !== null;
      const epId = isEp ? `ep_${media.id}_${selectedSeasonNum}_${expandedEpisodeNum}` : undefined;
      
      const payload: any = { type: reactionType };
      if (isEp) {
        payload.episodeId = epId;
      } else if (mediaType === 'show') {
        payload.showId = media.id;
      } else {
        payload.movieId = media.id;
      }

      await backendApi.post('/api/reactions', payload);
      loadCommentsAndReactions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEpisodeClick = (epNum: number) => {
    if (expandedEpisodeNum === epNum) {
      setExpandedEpisodeNum(null);
    } else {
      setExpandedEpisodeNum(epNum);
    }
  };

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

      {/* Backdrop Banner Panel */}
      <div 
        className="backdrop-banner glass-panel" 
        style={{ 
          height: '350px', 
          borderRadius: 'var(--radius-lg)', 
          backgroundImage: `linear-gradient(to top, var(--bg-dark) 0%, rgba(7, 7, 10, 0.4) 60%, rgba(0, 0, 0, 0.2) 100%), url(${getImageUrl(media.backdropPath, 'original')})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'end',
          padding: '30px',
          marginBottom: '30px',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        {/* Poster & Main Header info overlap */}
        <div style={{ display: 'flex', gap: '24px', alignItems: 'end', width: '100%', flexWrap: 'wrap' }} className="header-details">
          <img 
            src={getImageUrl(media.posterPath)} 
            alt={media.title}
            style={{ width: '130px', height: '195px', objectFit: 'cover', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
          <div style={{ flex: 1, minWidth: '240px' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '36px', marginBottom: '8px', lineHeight: '1.2' }}>{media.title}</h1>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {media.genres?.map((g: string) => (
                <span key={g} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                  {g}
                </span>
              ))}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '800px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.5' }}>
              {media.overview || "Sem sinopse disponível."}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px' }} className="detail-grid">
        
        {/* Left Column: Actions / Seasons & Episodes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Action Row */}
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
            {mediaType === 'movie' ? (
              <>
                <button 
                  onClick={() => toggleWatchMovie(media.id, media)}
                  className="btn-primary"
                  style={{ background: isMovieWatched ? 'var(--accent)' : 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' }}
                >
                  <CheckCircle size={18} />
                  {isMovieWatched ? 'Assistido' : 'Marcar como Assistido'}
                </button>
                <button 
                  onClick={() => toggleFavoriteMovie(media.id, media)}
                  className="btn-secondary"
                  style={{ color: isMovieFavorite ? 'var(--secondary)' : 'var(--text-primary)', borderColor: isMovieFavorite ? 'var(--secondary)' : 'var(--border-color)' }}
                >
                  <Heart size={18} fill={isMovieFavorite ? 'var(--secondary)' : 'transparent'} />
                  {isMovieFavorite ? 'Favorito' : 'Adicionar aos Favoritos'}
                </button>
              </>
            ) : (
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Série em andamento • Status: <strong>{media.status || 'Ativa'}</strong>
              </div>
            )}

            {/* List Dropdown Toggle */}
            <div style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowListDropdown(!showListDropdown)}
                className="btn-secondary"
              >
                <Plus size={18} />
                Adicionar à Lista
              </button>
              {showListDropdown && (
                <div className="glass-panel" style={{ position: 'absolute', top: '100%', left: 0, marginTop: '8px', zIndex: 10, width: '220px', padding: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                  {lists.length === 0 ? (
                    <div style={{ fontSize: '12px', padding: '8px', color: 'var(--text-muted)' }}>Crie uma lista na aba Listas primeiro.</div>
                  ) : (
                    lists.map(list => (
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

          {/* Episode List (For Shows) */}
          {mediaType === 'show' && (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ fontSize: '20px', fontFamily: 'var(--font-display)' }}>Episódios</h3>
                
                {/* Seasons Dropdown Selector */}
                <div style={{ position: 'relative', minWidth: '160px' }}>
                  <select 
                    value={selectedSeasonNum} 
                    onChange={(e) => { setSelectedSeasonNum(Number(e.target.value)); setExpandedEpisodeNum(null); }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '8px 36px 8px 16px',
                      fontSize: '13px',
                      borderRadius: 'var(--radius-sm)',
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
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Season Progress Bar */}
              <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  {isSeasonComplete ? (
                    <span style={{ display: 'inline-flex', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '11px', fontWeight: 'bold' }}>
                      Temporada Completa!
                    </span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Progresso: <strong>{watchedInSeason} / {seasonEpisodes.length}</strong>
                      </span>
                      <button 
                        onClick={() => watchAllEpisodesOfSeason(media, seasonEpisodes, selectedSeasonNum)}
                        className="btn-primary glow-hover"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', height: 'fit-content' }}
                      >
                        Marcar Temporada como Assistida
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginLeft: '20px' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {seasonEpisodes.map((ep: any) => {
                    const epId = `ep_${media.id}_${selectedSeasonNum}_${ep.episodeNumber}`;
                    const watched = isEpisodeWatched(epId);
                    const isExpanded = expandedEpisodeNum === ep.episodeNumber;

                    return (
                      <div 
                        key={ep.episodeNumber} 
                        className="glass-card" 
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
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
                          <div style={{ padding: '0 20px 20px 58px', borderTop: '1px solid rgba(255,255,255,0.03)', background: 'rgba(0,0,0,0.15)' }} className="animate-fade-in">
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', marginTop: '12px', marginBottom: '18px' }}>
                              {ep.overview || "Sem sinopse disponível."}
                            </p>

                            {/* Accordion Comments & Reactions section */}
                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                              <h5 style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comentários do Episódio</h5>
                              
                              {/* Reactions Row */}
                              <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
                                {['like', 'love', 'wow', 'sad'].map(type => {
                                  const emo: Record<string, string> = { like: '👍', love: '❤️', wow: '😮', sad: '😢' };
                                  const isActive = reactions.userReactionType === type;
                                  return (
                                    <button 
                                      key={type}
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
                                      <div>{c.content}</div>
                                    </div>
                                  ))
                                )}
                              </div>

                              {/* Comment Form */}
                              <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px' }}>
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
                              </form>
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

          {/* Movie Comments (if mediaType is movie) */}
          {mediaType === 'movie' && (
            <section className="glass-panel" style={{ padding: '24px' }}>
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
                      <div>{c.content}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Comment Input */}
              <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Escreva sua opinião..."
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button type="submit" className="btn-primary">
                  Enviar
                </button>
              </form>
            </section>
          )}

        </div>

        {/* Right Column: Streaming and Info Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          {/* Availability (Watchmode style) */}
          <section className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', marginBottom: '14px' }}>Onde Assistir</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Mocking watch availability providers */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#e50914', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>N</div>
                  <span>Netflix</span>
                </div>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '11px' }}>Assinatura</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#00a8e1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>a</div>
                  <span>Prime Video</span>
                </div>
                <span style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '11px' }}>Assinatura</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#f59e0b', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>TM</div>
                  <span>Watchmode</span>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Consultar Aluguel</span>
              </div>

            </div>
          </section>

          {/* Quick Technical details */}
          <section className="glass-panel" style={{ padding: '20px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
        @media (max-width: 800px) {
          .detail-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
