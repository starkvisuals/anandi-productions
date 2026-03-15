'use client';

import { useState, useEffect, useRef } from 'react';

export default function InterviewChat({ interviewId, candidateName, position, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);
  const isFirstMessage = useRef(true);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-start: send greeting trigger on mount
  useEffect(() => {
    if (isFirstMessage.current) {
      isFirstMessage.current = false;
      sendMessage(`Hi, I'm ${candidateName}. I'm here for the ${position} interview.`, true);
    }
  }, []);

  const sendMessage = async (text, silent = false) => {
    const userText = text || input.trim();
    if (!userText || isTyping || isComplete) return;

    if (!silent) {
      setMessages(prev => [...prev, { role: 'user', content: userText, id: Date.now() }]);
      setInput('');
    }
    setIsTyping(true);
    setError('');

    try {
      const response = await fetch('/api/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId, userMessage: userText }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aiText = '';
      const msgId = Date.now() + 1;

      setMessages(prev => [...prev, { role: 'assistant', content: '', id: msgId, streaming: true }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        aiText += chunk;

        setMessages(prev =>
          prev.map(m => m.id === msgId ? { ...m, content: aiText } : m)
        );
      }

      // Mark as done streaming
      setMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, streaming: false } : m)
      );

      // Check for interview complete signal
      if (aiText.includes('[INTERVIEW_COMPLETE]')) {
        // Clean the marker from display
        setMessages(prev =>
          prev.map(m => m.id === msgId
            ? { ...m, content: aiText.replace('[INTERVIEW_COMPLETE]', '').trim(), streaming: false }
            : m)
        );
        setIsComplete(true);
        await triggerScoring();
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  const triggerScoring = async () => {
    setIsScoring(true);
    try {
      await fetch('/api/interview/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interviewId }),
      });
      setTimeout(() => onComplete?.(), 2000);
    } catch (err) {
      console.error('Scoring error:', err);
      setTimeout(() => onComplete?.(), 3000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (id) => {
    const d = new Date(id);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '12px 12px 0 0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>🎯</div>
        <div>
          <div style={{ color: '#e4e4e7', fontWeight: '700', fontSize: '15px' }}>Aria — Anandi Productions Hiring Assistant</div>
          <div style={{ color: '#6b7280', fontSize: '12px' }}>
            {isScoring ? '⏳ Processing your interview...' : isComplete ? '✅ Interview completed' : '🟢 Interview in progress'}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', background: '#0d0d14', border: '1px solid #1e1e2e', borderRadius: '20px', padding: '4px 12px', color: '#a78bfa', fontSize: '12px', fontWeight: '600' }}>
          {position}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#0d0d14', border: '1px solid #1e1e2e', borderTop: 'none', minHeight: '400px', maxHeight: '520px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#4b5563', fontSize: '14px', marginTop: '60px' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💬</div>
            Starting your interview...
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '16px',
              gap: '10px',
              alignItems: 'flex-end',
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>🎯</div>
            )}
            <div style={{ maxWidth: '75%' }}>
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #7c3aed)' : '#16161f',
                  border: msg.role === 'user' ? 'none' : '1px solid #1e1e2e',
                  color: '#e4e4e7',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
                {msg.streaming && (
                  <span style={{ display: 'inline-block', width: '6px', height: '14px', background: '#6366f1', marginLeft: '4px', animation: 'blink 1s infinite', verticalAlign: 'text-bottom', borderRadius: '2px' }} />
                )}
              </div>
              <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '4px', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                {formatTime(msg.id)}
              </div>
            </div>
            {msg.role === 'user' && (
              <div style={{ width: '32px', height: '32px', background: '#1e1e2e', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', flexShrink: 0 }}>👤</div>
            )}
          </div>
        ))}

        {isTyping && !messages.some(m => m.streaming) && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '16px' }}>
            <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🎯</div>
            <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderRadius: '18px 18px 18px 4px', padding: '12px 16px', display: 'flex', gap: '4px', alignItems: 'center' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '6px', height: '6px', background: '#6366f1', borderRadius: '50%', animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
              ))}
            </div>
          </div>
        )}

        {isScoring && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#9ca3af', fontSize: '14px' }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
            Evaluating your interview responses...
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ background: '#16161f', border: '1px solid #1e1e2e', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px' }}>
        {error && (
          <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '8px', padding: '8px 12px', background: '#1a0a0a', borderRadius: '6px' }}>
            ⚠️ {error}
          </div>
        )}

        {isComplete ? (
          <div style={{ textAlign: 'center', color: '#22c55e', fontSize: '14px', padding: '8px' }}>
            ✅ Interview complete! Your responses are being evaluated.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response and press Enter to send..."
              disabled={isTyping || isComplete}
              style={{
                flex: 1,
                background: '#0d0d14',
                border: '1px solid #1e1e2e',
                borderRadius: '10px',
                padding: '12px 14px',
                color: '#e4e4e7',
                fontSize: '14px',
                resize: 'none',
                minHeight: '44px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                outline: 'none',
              }}
              rows={1}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping || isComplete}
              style={{
                width: '44px',
                height: '44px',
                background: (!input.trim() || isTyping) ? '#1e1e2e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                cursor: (!input.trim() || isTyping) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0,
                transition: 'all 0.2s',
              }}
            >
              ↑
            </button>
          </div>
        )}
        <div style={{ color: '#4b5563', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
          Press Enter to send · Shift+Enter for new line
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }
      `}</style>
    </div>
  );
}
