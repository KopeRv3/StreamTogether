import { useRoomStore } from '../../stores/roomStore';
import { Avatar } from '../ui/Avatar';

export function ParticipantList() {
  const { participants } = useRoomStore();

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-3">Participantes ({participants.length})</h3>
      <div className="space-y-2">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-3">
            <Avatar username={p.user.username} avatarUrl={p.user.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{p.user.username}</p>
            </div>
            {p.role === 'host' && (
              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                Anfitrión
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
