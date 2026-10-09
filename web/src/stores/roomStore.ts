import { create } from 'zustand';
import { Room, RoomParticipant, ChatMessage, RoomState } from '../types';

interface RoomStateStore {
  currentRoom: Room | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  syncState: RoomState;
  isHost: boolean;
  setCurrentRoom: (room: Room | null) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  addParticipant: (participant: RoomParticipant) => void;
  removeParticipant: (userId: string) => void;
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setSyncState: (state: RoomState) => void;
  setIsHost: (isHost: boolean) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomStateStore>((set) => ({
  currentRoom: null,
  participants: [],
  messages: [],
  syncState: {
    position: 0,
    playing: false,
    timestamp: Date.now(),
    videoId: null,
  },
  isHost: false,
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setParticipants: (participants) => set({ participants }),
  addParticipant: (participant) =>
    set((state) => ({ participants: [...state.participants, participant] })),
  removeParticipant: (userId) =>
    set((state) => ({
      participants: state.participants.filter((p) => p.userId !== userId),
    })),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  setSyncState: (syncState) => set({ syncState }),
  setIsHost: (isHost) => set({ isHost }),
  reset: () =>
    set({
      currentRoom: null,
      participants: [],
      messages: [],
      syncState: { position: 0, playing: false, timestamp: Date.now(), videoId: null },
      isHost: false,
    }),
}));
