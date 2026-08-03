import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { getImageUrl } from '../services/api.js';
import { Plus, List, Trash2, ArrowLeft, Tv, Film, Star } from 'lucide-react';
import { pushToast } from '../services/toast.js';

export const Lists: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { lists, createList, deleteList, removeFromList, fetchListItems } = useTracking();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListDetails, setSelectedListDetails] = useState<any | null>(null);
  
  // Create list form state
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'show' | 'movie' | 'mixed'>('mixed');
  const [loadingItems, setLoadingItems] = useState(false);

  // Load details and populated items when a list is selected
  const loadListItems = async (listId: string) => {
    setLoadingItems(true);
    try {
      const data = await fetchListItems(listId);
      setSelectedListDetails(data);
    } catch (e) {
      console.error(e);
      setSelectedListId(null);
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    if (selectedListId) {
      loadListItems(selectedListId);
    } else {
      setSelectedListDetails(null);
    }
  }, [selectedListId]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await createList(name, description, type);
    setName('');
    setDescription('');
    setType('mixed');
    setIsCreating(false);
  };

  const handleDeleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening list
    await deleteList(listId);
    pushToast('info', 'Lista excluída.');
    if (selectedListId === listId) {
      setSelectedListId(null);
    }
  };

  const handleRemoveItem = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedListId) {
      const success = await removeFromList(selectedListId, mediaId);
      if (success) {
        loadListItems(selectedListId);
      }
    }
  };

  return (
    <div className="lists-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Title section */}
      {!selectedListId && (
        <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px' }}>Minhas Listas</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Organize suas séries e filmes em coleções personalizadas.</p>
          </div>
          <button onClick={() => setIsCreating(true)} className="st-btn-primary">
            <Plus size={16} />
            Criar Nova Lista
          </button>
        </div>
      )}

      {/* Creation Modal / Form */}
      {isCreating && (
        <div className="st-panel" style={{ padding: '24px', marginBottom: '30px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px' }}>Nova Lista Personalizada</h3>
          <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Nome da Lista</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Minhas Séries de Suspense Favoritas"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Descrição (Opcional)</label>
              <textarea 
                placeholder="Ex: Coleção com as melhores séries de suspense psicológico de todos os tempos."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo de Lista</label>
              <select 
                value={type}
                onChange={e => setType(e.target.value as any)}
                style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="mixed">Misto (Séries e Filmes)</option>
                <option value="show">Apenas Séries</option>
                <option value="movie">Apenas Filmes</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'end' }}>
              <button type="button" onClick={() => setIsCreating(false)} className="st-btn-secondary">Cancelar</button>
              <button type="submit" className="st-btn-primary">Criar Lista</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Lists Display */}
      {!selectedListId ? (
        <>
          {/* Custom Lists */}
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <List size={18} style={{ color: 'var(--primary)' }} />
              Listas Personalizadas
            </h3>
          </div>

          {lists.length === 0 ? (
          <div className="st-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <List size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
            <p>Você não tem nenhuma lista personalizada criada.</p>
            <p style={{ fontSize: '13px', marginTop: '6px' }}>Clique no botão "Criar Nova Lista" no canto superior para iniciar!</p>
          </div>
        ) : (
          <div className="lists-cards-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {lists.map(list => (
              <div 
                key={list.id} 
                className="st-card glow-hover" 
                onClick={() => setSelectedListId(list.id)}
                style={{ padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '180px' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>{list.name}</h3>
                    <button 
                      onClick={(e) => handleDeleteList(list.id, e)} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', transition: 'color var(--transition-fast)' }}
                      onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                    {list.description || "Nenhuma descrição disponível."}
                  </p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
                  <span style={{ textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>{list.type === 'mixed' ? 'Mista' : list.type === 'show' ? 'Séries' : 'Filmes'}</span>
                  <span>{list.itemCount} itens</span>
                </div>
              </div>
            ))}
          </div>
        )
        }
        </>
      ) : (
        /* Detailed List View */
        <div>
          {/* Header & Back Button */}
          <div className="list-detail-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <button onClick={() => setSelectedListId(null)} className="st-btn-secondary" style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
              <ArrowLeft size={16} />
              Voltar
            </button>
            {selectedListDetails && (
              <div>
                <h3 style={{ fontSize: '24px', fontFamily: 'var(--font-display)' }}>{selectedListDetails.list.name}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{selectedListDetails.list.description}</p>
              </div>
            )}
          </div>

          {loadingItems ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Carregando itens da lista...</div>
          ) : !selectedListDetails || selectedListDetails.items.length === 0 ? (
            <div className="st-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p>Esta lista está vazia.</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>Busque por uma série ou filme e adicione nesta lista pela página de detalhes!</p>
            </div>
          ) : (
            <div className="grid-media">
              {selectedListDetails.items.map((item: any) => {
                const media = item.details;
                if (!media) return null;
                return (
                  <div 
                    key={item.id} 
                    className="st-card glow-hover" 
                    onClick={() => onViewMedia(media.id, item.mediaType)}
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
                  >
                    <div style={{ position: 'relative', width: '100%', paddingTop: '150%' }}>
                      <img 
                        src={getImageUrl(media.posterPath)} 
                        alt={media.title} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      {/* Delete icon float top right */}
                      <button 
                        onClick={(e) => handleRemoveItem(media.id, e)}
                        style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(7, 7, 10, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '6px', borderRadius: '50%', color: 'var(--text-secondary)', cursor: 'pointer', zIndex: 5 }}
                        title="Remover da lista"
                        onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Media type badge */}
                      <div style={{ position: 'absolute', top: '10px', left: '10px' }}>
                        <span style={{ 
                          background: item.mediaType === 'show' ? 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)' : 'linear-gradient(135deg, var(--accent) 0%, #059669 100%)',
                          color: 'white', fontSize: '9px', fontWeight: 'bold', padding: '3px 6px', borderRadius: 'var(--radius-sm)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '3px'
                        }}>
                          {item.mediaType === 'show' ? <Tv size={8} /> : <Film size={8} />}
                          {item.mediaType === 'show' ? 'Série' : 'Filme'}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{media.title}</h4>
                      {media.rating > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          <Star size={10} fill="var(--warning)" color="var(--warning)" />
                          {media.rating.toFixed(1)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 760px) {
          .lists-cards-grid {
            grid-template-columns: 1fr !important;
          }

          .list-detail-header {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .list-detail-header button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

    </div>
  );
};
