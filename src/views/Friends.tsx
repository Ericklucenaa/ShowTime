import React, { useEffect, useState } from 'react';
import { useTracking } from '../context/TrackingContext.js';
import { Users, Clock, Activity, Search as SearchIcon } from 'lucide-react';
import { db, isFirebaseEnabled } from '../services/firebase.js';
import { doc, getDoc } from 'firebase/firestore/lite';

export const Friends: React.FC<{ onViewProfile?: (userId: string, username: string) => void }> = ({ onViewProfile }) => {
  const { followedUsers } = useTracking();
  const [friendsData, setFriendsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFriends = async () => {
      if (!isFirebaseEnabled || !db) {
        // Mock data for offline mode
        setFriendsData([
          { id: 'mock1', username: 'joaosilva', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=joaosilva`, lastActive: 'Há 5 minutos', recentWatch: 'Breaking Bad - S05E14' },
          { id: 'mock2', username: 'mariaclara', avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=mariaclara`, lastActive: 'Há 2 horas', recentWatch: 'The Last of Us - S01E03' }
        ]);
        setLoading(false);
        return;
      }

      try {
        const loaded: any[] = [];
        for (const uid of followedUsers) {
          const userDoc = await getDoc(doc(db, 'profiles', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            loaded.push({
              id: uid,
              username: data.username,
              avatarUrl: data.avatarUrl,
              lastActive: 'Recentemente', // Simulated
              recentWatch: 'Assistindo TV...' // Simulated, would require fetching latest watch_episodes
            });
          }
        }
        setFriendsData(loaded);
      } catch (e) {
        console.error("Error loading friends:", e);
      } finally {
        setLoading(false);
      }
    };

    loadFriends();
  }, [followedUsers]);

  return (
    <div className="friends-view animate-fade-in" style={{ paddingBottom: '40px' }}>
      <div style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '28px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} style={{ color: 'var(--secondary)' }} />
            Amigos
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>Veja a atividade recente de quem você segue.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Carregando...</div>
      ) : friendsData.length === 0 ? (
        <div className="st-panel" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Users size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p>Você ainda não está seguindo ninguém.</p>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Vá até a aba Descobrir para encontrar outros usuários.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {friendsData.map(friend => (
            <div key={friend.id} className="st-card glow-hover" style={{ display: 'flex', padding: '20px', alignItems: 'center', gap: '20px', cursor: 'pointer' }} onClick={() => onViewProfile?.(friend.id, friend.username)}>
              <div style={{ position: 'relative' }}>
                <img 
                  src={friend.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${friend.username}`}
                  alt={friend.username}
                  style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--secondary)' }}
                />
                <div style={{ position: 'absolute', bottom: '0', right: '0', width: '14px', height: '14px', background: 'var(--accent)', borderRadius: '50%', border: '2px solid var(--bg-card)' }} title="Online"></div>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '18px', marginBottom: '4px' }}>@{friend.username}</h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {friend.lastActive}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={12} /> Assistiu: {friend.recentWatch}</span>
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                <SearchIcon size={20} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
