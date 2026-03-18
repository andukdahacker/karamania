import * as mediaRepository from '../persistence/media-repository.js';

export async function persistCaptureMetadata(params: {
  sessionId: string;
  userId: string | null;
  captureType: string;
  triggerType: string;
  djStateAtCapture: unknown | null;
}): Promise<string | null> {
  try {
    const captureId = crypto.randomUUID();
    const ext = params.captureType === 'photo' ? 'jpg'
      : params.captureType === 'video' ? 'mp4'
      : 'm4a';
    const storagePath = `${params.sessionId}/${captureId}.${ext}`;

    await mediaRepository.create({
      id: captureId,
      sessionId: params.sessionId,
      userId: params.userId,
      storagePath,
      triggerType: params.triggerType,
      djStateAtCapture: params.djStateAtCapture,
    });

    return captureId;
  } catch (error) {
    console.error('Failed to persist capture metadata:', error);
    return null;
  }
}
