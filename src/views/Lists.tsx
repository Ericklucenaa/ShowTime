import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { getImageUrl } from '../services/api.js';
import { Plus, Trash2, ArrowLeft, Star } from 'lucide-react';
import { pushToast } from '../services/toast.js';

export const Lists: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { lists, createList, deleteList, removeFromList, fetchListItems } = useTracking();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListDetails, setSelectedListDetails] = useState<any | null>(null);
  
  // Create list form state
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

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

    const success = await createList(name, description, 'mixed');
    if (success) {
      setName('');
      setDescription('');
      setIsCreating(false);
      pushToast('success', 'Lista criada com sucesso.');
    }
  };

  const handleDeleteList = async (listId: string, e: React.MouseEvent) => {
    e.stopPropagation();
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
    <div className="lists-view animate-fade-in" style={{ paddingBottom: '32px' }}>
      
      {/* Title section */}
      {!selectedListId && (
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Minhas Listas</h2>
          <button onClick={() => setIsCreating(true)} className="st-btn-primary">
            <Plus size={15} />
            Nova Lista
          </button>
        </div>
      )}

      {/* Creation Modal / Form */}
      {isCreating && (
        <div className="st-panel" style={{ padding: '18px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Nova Lista</h3>
          <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Nome da lista</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Favoritos de Suspense"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', height: '34px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 10px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Descrição (opcional)</label>
              <textarea 
                placeholder="Breve descrição da lista..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                style={{ width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setIsCreating(false)} className="st-btn-secondary">Cancelar</button>
              <button type="submit" className="st-btn-primary">Salvar Lista</button>
            </div>
          </form>
        </div>
      )}

      {/* Main Lists Display */}
      {!selectedListId ? (
        <>
          {lists.length === 0 ? (
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <p>Nenhuma lista personalizada criada.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {lists.map(list => (
                <div 
                  key={list.id} 
                  className="st-card" 
                  onClick={() => setSelectedListId(list.id)}
                  style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }}>
                        {list.name}
                      </h3>
                      <button 
                        onClick={(e) => handleDeleteList(list.id, e)} 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                        title="Excluir lista"
                        onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {list.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                        {list.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: '10px' }}>
                    <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{list.type === 'mixed' ? 'Mista' : list.type === 'show' ? 'Séries' : 'Filmes'}</span>
                    <span>{list.itemCount} {list.itemCount === 1 ? 'item' : 'itens'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Detailed List View */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button onClick={() => setSelectedListId(null)} className="st-btn-secondary" style={{ padding: '0 10px', height: '32px' }}>
              <ArrowLeft size={14} />
              Voltar
            </button>
            {selectedListDetails && (
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>{selectedListDetails.list.name}</h3>
                {selectedListDetails.list.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{selectedListDetails.list.description}</p>
                )}
              </div>
            )}
          </div>

          {loadingItems ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>Carregando itens...</div>
          ) : !selectedListDetails || selectedListDetails.items.length === 0 ? (
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              Esta lista está vazia.
            </div>
          ) : (
            <div className="grid-media">
              {selectedListDetails.items.map((item: any) => {
                const media = item.details;
                if (!media) return null;
                return (
                  <div 
                    key={item.id} 
                    className="st-card" 
                    onClick={() => onViewMedia(media.id, item.mediaType)}
                    style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}
                  >
                    <div style={{ position: 'relative', width: '100%', paddingTop: '150%' }}>
                      <img 
                        src={getImageUrl(media.posterPath)} 
                        alt={media.title} 
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      
                      <button 
                        onClick={(e) => handleRemoveItem(media.id, e)}
                        style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0, 0, 0, 0.75)', border: '1px solid rgba(255,255,255,0.2)', width: '26px', height: '26px', borderRadius: 'var(--radius-xs)', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}
                        title="Remover da lista"
                        onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                        onMouseOut={e => e.currentTarget.style.color = '#ffffff'}
                      >
                        <Trash2 size={13} />
                      </button>

                      <div style={{ position: 'absolute', top: '6px', left: '6px', zIndex: 2 }}>
                        <span className="media-badge-type">
                          {item.mediaType === 'show' ? 'Série' : 'Filme'}
                        </span>
                      </div>
                    </div>
                    <div style={{ padding: '8px 10px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <h4 style={{ fontSize: '13px', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontWeight: 600 }}>
                        {media.title}
                      </h4>
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
    </div>
  );
};
