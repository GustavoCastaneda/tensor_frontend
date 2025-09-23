import { auth } from '@clerk/nextjs/server';

export const maxDuration = 30;

type IncomingSSEPayload =
  | { type: 'info'; citations?: unknown; stream?: boolean }
  | { type: 'token'; text?: string }
  | { type: 'reasoning'; text?: string }
  | { type: 'final'; response?: unknown }
  | { type: 'error'; message?: string }
  | ({ type?: string } & Record<string, unknown>);

type IncomingMessagePart = {
  type: string;
  text?: string;
};

type IncomingMessage = {
  id?: string;
  role?: string;
  parts?: IncomingMessagePart[];
};

type ChatStreamRequestBody = {
  messages?: IncomingMessage[];
  data?: {
    workspace_id?: string;
  };
};

export async function POST(request: Request) {
  const { messages, data } = (await request.json()) as ChatStreamRequestBody;

  if (!messages || messages.length === 0) {
    return new Response('Missing messages', { status: 400 });
  }

  try {
    const { getToken } = await auth();
    const token = await getToken({ template: 'Tensor' });

    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }

    const workspaceId = data?.workspace_id;
    if (!workspaceId) {
      return new Response('Missing workspace_id', { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const userMessage =
      lastMessage?.parts?.find((part) => part.type === 'text')?.text || '';

    const backendUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/chat/semantic`;

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        workspace_id: workspaceId,
        message: userMessage,
        intent: 'semantic',
        stream: true,
        k: 8,
        rerank: true,
        min_score: 0.35,
        per_page_cap: 2,
        per_doc_cap: 4,
        include_debug: true,
        include_thinking_summary: true,
        trace_level: 'basic',
      }),
    });

    if (!backendResponse.ok || !backendResponse.body) {
      const errorText = await backendResponse.text();
      return new Response(`Backend error: ${errorText}`, {
        status: backendResponse.status,
      });
    }

    const stream = new ReadableStream({
      start(controller) {
        const reader = backendResponse.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        const textStreamId = 'answer';
        let textStarted = false;
        let textEnded = false;
        let finished = false;
        let metadata: Record<string, unknown> = {};

        const enqueueChunk = (chunk: unknown) => {
          if (finished) return; // Prevent enqueueing after finish
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          } catch (error) {
            console.warn('Failed to enqueue chunk:', error);
          }
        };

        const ensureTextStart = () => {
          if (textStarted) return;
          textStarted = true;
          enqueueChunk({ type: 'text-start', id: textStreamId });
        };

        const ensureTextEnd = () => {
          if (!textStarted || textEnded) return;
          textEnded = true;
          enqueueChunk({ type: 'text-end', id: textStreamId });
        };

        const mergeMetadata = (extra: Record<string, unknown> | undefined) => {
          if (!extra) return;
          metadata = { ...metadata, ...extra };
          enqueueChunk({ type: 'message-metadata', messageMetadata: metadata });
        };

        const sendFinish = (extra?: Record<string, unknown>) => {
          if (finished) return;
          finished = true;
          
          if (extra) {
            metadata = { ...metadata, ...extra };
          }
          ensureTextEnd();
          enqueueChunk({ type: 'finish', messageMetadata: metadata });
          
          // Cancel reader and close controller safely
          reader.cancel().catch(() => undefined);
          try {
            controller.enqueue(encoder.encode('event: done\n\n'));
            controller.close();
          } catch (error) {
            console.warn('Failed to close controller:', error);
          }
        };

        const processPayload = (payload: IncomingSSEPayload) => {
          switch (payload.type) {
            case 'info': {
              const infoMetadata: Record<string, unknown> = {};
              if (payload.citations) infoMetadata.citations = payload.citations;
              if (payload.stream !== undefined) infoMetadata.stream = payload.stream;
              mergeMetadata(infoMetadata);
              break;
            }
            case 'token': {
              const delta = typeof payload.text === 'string' ? payload.text : undefined;
              if (!delta) break;
              ensureTextStart();
              enqueueChunk({ type: 'text-delta', id: textStreamId, delta });
              break;
            }
            case 'reasoning': {
              if (typeof payload.text !== 'string' || !payload.text) break;
              enqueueChunk({ type: 'reasoning', text: payload.text });
              break;
            }
            case 'final': {
              const responseMeta = payload.response && typeof payload.response === 'object'
                ? { response: payload.response }
                : undefined;
              mergeMetadata(responseMeta as Record<string, unknown> | undefined);
              sendFinish();
              break;
            }
            case 'error': {
              enqueueChunk({ type: 'error', errorText: payload.message ?? 'Unknown error' });
              sendFinish();
              break;
            }
            default:
              break;
          }
        };

        const flushBuffer = (buffer: string) => {
          const data = buffer.trim();
          if (!data) return;

          if (data === '[DONE]') {
            sendFinish();
            return;
          }

          try {
            const parsed = JSON.parse(data) as IncomingSSEPayload;
            processPayload(parsed);
          } catch (error) {
            console.warn('Error parsing SSE data:', error, data);
          }
        };

        let buffer = '';

        const readLoop = async () => {
          try {
            while (true) {
              if (finished) break;

              const { value, done } = await reader.read();
              if (done) {
                if (buffer && !finished) {
                  flushBuffer(buffer);
                }
                if (!finished) {
                  sendFinish();
                }
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              let newlineIndex: number;
              while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                if (finished) break;
                
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);

                const trimmed = line.trimEnd();
                if (!trimmed) {
                  continue;
                }

                if (trimmed.startsWith('event:')) {
                  const eventName = trimmed.slice(6).trim();
                  if (eventName === 'done' && !finished) {
                    sendFinish();
                  }
                  continue;
                }

                if (trimmed.startsWith('data:')) {
                  const dataPart = trimmed.slice(5).trim();
                  flushBuffer(dataPart);
                }
              }
            }
          } catch (error) {
            console.error('Stream error:', error);
            if (!finished) {
              // Handle specific ResponseStream error
              const errorMessage = error instanceof Error ? error.message : 'Stream error';
              if (errorMessage.includes('ResponseStream') && errorMessage.includes('wait')) {
                enqueueChunk({
                  type: 'error',
                  errorText: 'Error del servidor: problema con el stream de respuesta. Por favor, intenta de nuevo.',
                });
              } else {
                enqueueChunk({
                  type: 'error',
                  errorText: errorMessage,
                });
              }
              sendFinish();
            }
          }
        };

        readLoop();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Streaming error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
