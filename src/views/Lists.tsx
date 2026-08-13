import React, { useState, useEffect } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { getImageUrl } from '../services/api.js';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { pushToast } from '../services/toast.js';

export const Lists: React.FC<{ onViewMedia: (id: string, type: 'show' | 'movie') => void }> = ({ onViewMedia }) => {
  const { lists, createList, deleteList, removeFromList, fetchListItems } = useTracking();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [selectedListDetails, setSelectedListDetails] = useState<any | null>(null);
  
  // Create list form state (no description needed)
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
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

    const success = await createList(name.trim(), '', 'mixed');
    if (success) {
      setName('');
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
          <div>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Minhas Listas</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Crie coleções personalizadas para organizar suas séries, animes e filmes.</p>
          </div>
          <button onClick={() => setIsCreating(true)} className="st-btn-primary">
            <Plus size={15} />
            Nova Lista
          </button>
        </div>
      )}

      {/* Creation Modal / Form */}
      {isCreating && (
        <div className="st-panel animate-fade-in" style={{ padding: '18px', marginBottom: '20px', borderRadius: 'var(--radius-md)' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>Nova Lista</h3>
          <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Nome da lista</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Favoritos de Suspense, Animes de Outono..."
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ width: '100%', height: '38px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '0 12px', color: 'var(--text-primary)', outline: 'none', fontSize: '13px' }}
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
            <div className="st-panel" style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', borderRadius: 'var(--radius-md)' }}>
              <p style={{ margin: '0 0 12px' }}>Nenhuma lista personalizada criada ainda.</p>
              <button onClick={() => setIsCreating(true)} className="st-btn-primary" style={{ margin: '0 auto' }}>
                <Plus size={14} /> Criar Primeira Lista
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
              {lists.map(list => (
                <div 
                  key={list.id} 
                  className="st-card" 
                  onClick={() => setSelectedListId(list.id)}
                  style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '110px', borderRadius: 'var(--radius-md)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%', color: 'var(--text-primary)' }}>
                      {list.name}
                    </h3>
                    <button 
                      onClick={(e) => handleDeleteList(list.id, e)} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}
                      title="Excluir lista"
                      onMouseOver={e => e.currentTarget.style.color = 'var(--error)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', background: 'rgba(124, 92, 255, 0.12)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-xs)', fontWeight: 600 }}>
                      {list.itemCount || 0} {list.itemCount === 1 ? 'item' : 'itens'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ver detalhes →</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Selected List Content */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button 
              onClick={() => setSelectedListId(null)}
              className="st-btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              <ArrowLeft size={14} />
              Voltar para Listas
            </button>
            <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-display)', margin: 0 }}>
              {selectedListDetails?.list?.name || 'Detalhes da Lista'}
            </h2>
          </div>

          {loadingItems ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
              Carregando itens da lista...
            </div>
          ) : !selectedListDetails?.items || selectedListDetails.items.length === 0 ? (
            <div className="st-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <p style={{ margin: '0 0 10px', fontSize: '14px', fontWeight: 600 }}>Esta lista está vazia.</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Adicione séries, filmes ou animes clicando no botão "Adicionar à Lista" na página do título.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '16px' }}>
              {selectedListDetails.items.map((item: any) => (
                <div 
                  key={item.id || item.mediaId}
                  className="st-card"
                  onClick={() => onViewMedia(item.mediaId, item.mediaType)}
                  style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
                >
                  <div style={{ position: 'relative', width: '100%', paddingTop: '150%' }}>
                    <img 
                      src={getImageUrl(item.posterPath)} 
                      alt={item.title || 'Mídia'}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                    <button
                      onClick={(e) => handleRemoveItem(item.mediaId, e)}
                      style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.75)', border: 'none', borderRadius: '50%', color: 'var(--error)', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      title="Remover da lista"
                    >
                      <Trash2 size={12} />
                    </button>
                    <div style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(0,0,0,0.75)', borderRadius: 'var(--radius-xs)', padding: '2px 5px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', color: '#fff' }}>
                      {item.mediaType === 'show' ? 'Série' : 'Filme'}
                    </div>
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title || item.mediaId}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
