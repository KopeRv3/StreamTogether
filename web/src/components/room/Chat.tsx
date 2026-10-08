import { useState, useRef, useEffect } from 'react';
import { useRoomStore } from '../../stores/roomStore';
import { useAuthStore } from '../../stores/authStore';
import { getSocket } from '../../lib/socket';
import { Avatar } from '../ui/Avatar';

export function Chat() {
  const [message, setMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { messages, currentRoom, participants } = useRoomStore();
  const { user } = useAuthStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();

    const handleNewMessage = (msg: any) => {
      useRoomStore.getState().addMessage(msg);
    };

    const handleTyping = (data: { userId: string; username: string; isTyping: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          next.set(data.userId, data.username);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:typing', handleTyping);
    };
  }, []);

  const handleSend = () => {
    if (!message.trim() || !currentRoom) return;

    const socket = getSocket();
    socket.emit('chat:message', {
      roomId: currentRoom.id,
      content: message.trim(),
    });

    setMessage('');

    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('chat:typing', { roomId: currentRoom.id, isTyping: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    if (!currentRoom) return;

    const socket = getSocket();
    socket.emit('chat:typing', { roomId: currentRoom.id, isTyping: true });

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('chat:typing', { roomId: currentRoom.id, isTyping: false });
    }, 2000);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Chat</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-4">
            No hay mensajes aún. ¡Saluda!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <Avatar username={msg.user.username} avatarUrl={msg.user.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm text-gray-900">
                  {msg.user.username}
                </span>
                <span className="text-xs text-gray-500">{formatTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.size > 0 && (
        <div className="px-3 py-1 text-xs text-gray-500 italic">
          {Array.from(typingUsers.values()).join(', ')} está escribiendo...
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje..."
            maxLength={500}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}