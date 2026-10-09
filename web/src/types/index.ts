export interface User {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
}

export type VideoSource = 'upload' | 'youtube';

export interface Video {
  id: string;
  title: string;
  description: string | null;
  duration: number;
  thumbnailUrl: string | null;
  /** Upload: ruta local /uploads/...  YouTube: URL original */
  videoUrl: string;
  /** Solo presente cuando source === 'youtube' */
  youtubeId: string | null;
  source: VideoSource;
  ownerId: string | null;
  status: string;
  createdAt: string;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  videoId: string | null;
  status: string;
  createdAt: string;
  closedAt: string | null;
  host: User;
  video: Video | null;
  participants: RoomParticipant[];
}

export interface RoomParticipant {
  id: string;
  roomId: string;
  userId: string;
  role: 'host' | 'participant';
  joinedAt: string;
  leftAt: string | null;
  user: User;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  user: User;
}

export interface SyncEvent {
  type: 'play' | 'pause' | 'seek';
  position: number;
  serverTime: number;
}

export interface RoomState {
  position: number;
  playing: boolean;
  timestamp: number;
  videoId: string | null;
}
