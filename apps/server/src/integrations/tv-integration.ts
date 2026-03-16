export interface NowPlayingEvent {
  videoId: string;
  title?: string;
  state: 'playing' | 'paused' | 'buffering' | 'idle';
}

export type TvConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface TvIntegration {
  connect(pairingCode: string): Promise<void>;
  disconnect(): Promise<void>;
  addToQueue(videoId: string): Promise<void>;
  onNowPlaying(callback: (event: NowPlayingEvent) => void): void;
  onStatusChange(callback: (status: TvConnectionStatus) => void): void;
  isConnected(): boolean;
}

export type CreateTvIntegration = () => TvIntegration;
