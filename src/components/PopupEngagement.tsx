import { useState } from 'react';
import { useIncidentReactions, REACTION_TYPES } from '@/hooks/useIncidentReactions';
import { useIncidentComments } from '@/hooks/useIncidentComments';
import { useAuth } from '@/hooks/useAuth';
import { useIsPremium } from '@/hooks/useIsPremium';

interface Props {
  incidentId: string;
}

const AUTH_NUDGE_STYLE: React.CSSProperties = {
  fontSize: 10, color: '#f97316', background: '#fff7ed', border: '1px solid #fed7aa',
  borderRadius: 6, padding: '4px 8px', marginTop: 4, textAlign: 'center' as const,
};

const formatTimeAgo = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just nu';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
};

const PopupEngagement = ({ incidentId }: Props) => {
  const { user } = useAuth();
  const { isPremium } = useIsPremium();
  const { reactions, toggleReaction } = useIncidentReactions(incidentId);
  const { comments, loading, addComment, toggleLike, deleteComment } = useIncidentComments(incidentId);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [text, setText] = useState('');
  const [showAuthNudge, setShowAuthNudge] = useState(false);

  const visibleComments = isPremium ? comments : comments.slice(0, 3);
  const hiddenCount = isPremium ? 0 : Math.max(0, comments.length - 3);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    await addComment(text);
    setText('');
  };

  return (
    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: 8, paddingTop: 8 }}>
      {/* Reactions + comment toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {REACTION_TYPES.map((r, i) => {
          const data = reactions[i];
          const active = data?.userReacted;
          return (
            <button
              key={r.type}
              onClick={(e) => {
                e.stopPropagation();
                if (!user) { setShowAuthNudge(true); return; }
                toggleReaction(r.type);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '3px 8px',
                borderRadius: 12,
                border: active ? '1px solid rgba(59,130,246,0.4)' : '1px solid #e5e7eb',
                background: active ? 'rgba(59,130,246,0.08)' : '#f8f8f8',
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 500,
                color: active ? '#3b82f6' : '#888',
                lineHeight: 1,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 13 }}>{r.emoji}</span>
              <span>{data?.count || 0}</span>
            </button>
          );
        })}

        {/* Comment toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCommentsOpen(!commentsOpen);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            padding: '3px 8px',
            borderRadius: 12,
            border: commentsOpen ? '1px solid rgba(59,130,246,0.4)' : '1px solid #e5e7eb',
            background: commentsOpen ? 'rgba(59,130,246,0.08)' : '#f8f8f8',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 500,
            color: commentsOpen ? '#3b82f6' : '#888',
            lineHeight: 1,
            marginLeft: 'auto',
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 13 }}>💬</span>
          <span>{comments.length}</span>
        </button>
      </div>

      {/* Expandable comments section */}
      {commentsOpen && (
        <div style={{ marginTop: 8 }}>
          <div style={{ maxHeight: 180, overflowY: 'auto', paddingRight: 4 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#aaa' }}>
                Laddar kommentarer...
              </div>
            ) : visibleComments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 11, color: '#aaa' }}>
                Inga kommentarer ännu
              </div>
            ) : (
              visibleComments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: '#e5e7eb',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#888', flexShrink: 0, marginTop: 1,
                  }}>
                    {(c.user_id || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#333' }}>Anonym</span>
                      <span style={{ fontSize: 9, color: '#aaa' }}>{formatTimeAgo(c.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 10, color: '#555', margin: '2px 0 0', lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {c.text}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!user) { window.location.href = '/auth'; return; }
                          toggleLike(c.id, c.user_has_liked);
                        }}
                        style={{
                          fontSize: 9, color: c.user_has_liked ? '#3b82f6' : '#aaa',
                          cursor: 'pointer', background: 'none', border: 'none', padding: 0,
                          display: 'flex', alignItems: 'center', gap: 2,
                        }}
                      >
                        {c.user_has_liked ? '❤️' : '🤍'} {c.likes_count > 0 ? c.likes_count : ''}
                      </button>
                      {user && c.user_id === user.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteComment(c.id); }}
                          style={{ fontSize: 9, color: '#ef4444', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            {hiddenCount > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
                background: '#f8f8f8', borderRadius: 6, border: '1px solid #e5e7eb', marginTop: 4,
              }}>
                <span style={{ fontSize: 12 }}>🔒</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#333' }}>+{hiddenCount} fler kommentarer</div>
                  <div style={{ fontSize: 9, color: '#aaa' }}>Uppgradera till Pro</div>
                </div>
                <a
                  href="/account"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 9, fontWeight: 600, color: '#3b82f6', textDecoration: 'none' }}
                >
                  Uppgradera
                </a>
              </div>
            )}
          </div>

          {/* Comment input */}
          <div style={{ marginTop: 6 }}>
            {user ? (
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSubmit(); } }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Skriv en kommentar..."
                  maxLength={500}
                  style={{
                    flex: 1, padding: '5px 10px', fontSize: 10, borderRadius: 14,
                    border: '1px solid #e5e7eb', background: '#f8f8f8', outline: 'none',
                    color: '#333',
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); handleSubmit(); }}
                  disabled={!text.trim()}
                  style={{
                    padding: '4px 10px', borderRadius: 14, border: 'none',
                    background: text.trim() ? '#3b82f6' : '#e5e7eb',
                    color: text.trim() ? '#fff' : '#aaa',
                    fontSize: 10, fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default',
                  }}
                >
                  Skicka
                </button>
              </div>
            ) : (
              <a
                href="/auth"
                onClick={(e) => e.stopPropagation()}
                style={{
                  display: 'block', textAlign: 'center', padding: '6px 0',
                  fontSize: 10, color: '#888', textDecoration: 'none',
                  background: '#f8f8f8', borderRadius: 8, border: '1px solid #e5e7eb',
                }}
              >
                Logga in för att kommentera
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PopupEngagement;
