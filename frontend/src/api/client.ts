// API client for communicating with the ManimAI FastAPI backend

import type { ChatResponse, GenerationStatus, VideoResult } from '../types';

const BASE_URL = '/api';

/**
 * Send a chat message and get AI response.
 */
export async function sendChatMessage(
  messages: { role: string; content: string }[]
): Promise<ChatResponse> {
  const res = await fetch(`${BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * Start animation generation. Streams SSE progress events.
 * Calls onProgress with each status update, resolves with video result on done.
 */
export async function generateAnimation(
  messages: { role: string; content: string }[],
  topic: string,
  onProgress: (status: GenerationStatus) => void
): Promise<VideoResult> {
  const res = await fetch(`${BASE_URL}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, topic }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  return new Promise((resolve, reject) => {
    const processChunk = () => {
      reader.read().then(({ done, value }) => {
        if (done) {
          reject(new Error('Stream ended without a result'));
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === 'status') {
                onProgress({ step: data.step, message: data.message });
              } else if (eventType === 'done') {
                const videoId: string = data.video_id;
                resolve({
                  videoId,
                  videoUrl: `${BASE_URL}/video/${videoId}`,
                });
                return;
              } else if (eventType === 'error') {
                reject(new Error(data.message));
                return;
              }
            } catch {
              // Skip malformed lines
            }
          }
        }

        processChunk();
      }).catch(reject);
    };

    processChunk();
  });
}
