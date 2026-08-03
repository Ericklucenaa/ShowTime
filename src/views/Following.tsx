import React from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { Bookmark, Tv, BellOff } from 'lucide-react';

export const Following: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { followedShows, toggleFollowShow } = useTracking();

  return (
    <div className="following-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bookmark size={28} style={{ color: 'var(--primary)' }} />
            Séries que Sigo
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Acompanhe os próximos episódios das suas séries e animes favoritos.</p>
        </div>
      </div>

      {!followedShows || followedShows.length === 0 ? (
        <div className="st-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Tv size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p>Você ainda não está seguindo nenhuma série ou anime.</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Busque por uma série e clique em "Seguir" para acompanhá-la aqui.</p>
        </div>
      ) : (
        <div className="grid-media">
          {followedShows.map(showId => (
            <FollowedShowGridItem
              key={showId}
              showId={showId}
              onViewMedia={onViewMedia}
              onUnfollow={() => toggleFollowShow(showId)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FollowedShowGridItem: React.FC<{
  showId: string;
  onViewMedia: (id: string, type: 'show' | 'movie') => void;
  onUnfollow: () => void;
}> = ({ showId, onViewMedia, onUnfollow }) => {
  const [show, setShow] = React.useState<any>(null);

  React.useEffect(() => {
    fetchMediaDetails(showId, 'show')
      .then(s => setShow(s))
      .catch(() => {});
  }, [showId]);

  if (!show) {
    return (
      <div className="st-card" style={{ paddingBottom: '150%', position: 'relative', opacity: 0.5 }}>
         <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(255,255,255,0.05)' }} />
      </div>
    );
  }

  return (
    <div 
      className="st-card glow-hover" 
      onClick={() => onViewMedia(show.id, 'show')}
      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '150%' }}>
        <img 
          src={getImageUrl(show.posterPath)} 
          alt={show.title} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <button 
          onClick={(e) => { e.stopPropagation(); onUnfollow(); }}
          style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(7, 7, 10, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', zIndex: 5 }}
          title="Deixar de seguir"
          onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <BellOff size={14} />
        </button>
      </div>
      <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{show.title}</h4>
      </div>
    </div>
  );
};
