import React from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { fetchMediaDetails, getImageUrl } from '../services/api.js';
import { BellOff, Bookmark } from 'lucide-react';

export const Following: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { followedShows, toggleFollowShow } = useTracking();

  return (
    <div className="following-view animate-fade-in" style={{ paddingBottom: '32px' }}>
      
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          <Bookmark size={14} />
          <span>Coleção Pessoal</span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '-0.02em' }}>
          Minha Biblioteca
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Séries e produções que você acompanha ativamente no Epsync.
        </p>
      </div>

      {!followedShows || followedShows.length === 0 ? (
        <div className="st-panel" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Você ainda não está seguindo nenhuma série.
          </p>
          <p style={{ fontSize: '13px' }}>
            Navegue por Descobrir ou pelo Início e clique em "Seguir" para receber atualizações de episódios aqui!
          </p>
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
      <div className="st-card" style={{ paddingBottom: '150%', position: 'relative', opacity: 0.3 }}>
         <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'var(--bg-surface)' }} />
      </div>
    );
  }

  return (
    <div 
      className="st-card" 
      onClick={() => onViewMedia(show.id, 'show')}
      style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '150%', overflow: 'hidden' }}>
        <img 
          src={getImageUrl(show.posterPath)} 
          alt={show.title} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform var(--transition-normal)' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        />
        <button 
          onClick={(e) => { e.stopPropagation(); onUnfollow(); }}
          style={{ 
            position: 'absolute', 
            top: '8px', 
            right: '8px', 
            background: 'rgba(13, 13, 18, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.15)', 
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-xs)', 
            color: '#ffffff', 
            cursor: 'pointer', 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            transition: 'all var(--transition-fast)',
            backdropFilter: 'blur(4px)'
          }}
          title="Deixar de seguir"
          onMouseOver={e => {
            e.currentTarget.style.color = 'var(--error)';
            e.currentTarget.style.borderColor = 'var(--error)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
        >
          <BellOff size={14} />
        </button>
      </div>
      <div style={{ padding: '10px 12px', flex: 1 }}>
        <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 600 }}>
          {show.title}
        </h4>
      </div>
    </div>
  );
};
