import { NextRequest } from 'next/server';
import { Joker } from '@/lib/joker';
import { PipelineState } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SSEMessage {
  type: 'step_update' | 'log' | 'cost_update' | 'complete' | 'error' | 'ping';
  data: any;
}

function createSSEMessage(message: SSEMessage): string {
  return `data: ${JSON.stringify(message)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productUrl } = body;

    if (!productUrl || typeof productUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid productUrl' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const encoder = new TextEncoder();
    let controller: ReadableStreamDefaultController<any>;

    const stream = new ReadableStream({
      start(ctrl) {
        controller = ctrl;
      },
      cancel() {
        console.log('Stream cancelled by client');
      },
    });

    const sendMessage = (message: SSEMessage) => {
      try {
        controller.enqueue(encoder.encode(createSSEMessage(message)));
      } catch (error) {
        console.error('Error sending SSE message:', error);
      }
    };

    const joker = new Joker({
      productUrl,
      onStateChange: (state: PipelineState) => {
        sendMessage({
          type: 'step_update',
          data: {
            status: state.status,
            currentStep: state.currentStep,
            steps: state.steps,
            progress: calculateOverallProgress(state),
          },
        });

        if (state.logs.length > 0) {
          const latestLog = state.logs[state.logs.length - 1];
          sendMessage({
            type: 'log',
            data: latestLog,
          });
        }

        sendMessage({
          type: 'cost_update',
          data: {
            costs: state.costs,
            totalCost: state.totalCost,
          },
        });
      },
    });

    (async () => {
      try {
        sendMessage({
          type: 'step_update',
          data: {
            status: 'running',
            currentStep: 'scraping',
            message: 'Pipeline started',
          },
        });

        const keepAliveInterval = setInterval(() => {
          sendMessage({ type: 'ping', data: { timestamp: Date.now() } });
        }, 15000);

        const result = await joker.run();

        clearInterval(keepAliveInterval);

        if (result.status === 'success') {
          sendMessage({
            type: 'complete',
            data: {
              status: 'success',
              videoUrl: result.finalVideo?.url,
              totalCost: result.totalCost,
              costs: result.costs,
              completedAt: result.completedAt,
            },
          });
        } else {
          sendMessage({
            type: 'error',
            data: {
              status: 'failed',
              error: 'Pipeline failed',
              currentStep: result.currentStep,
            },
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendMessage({
          type: 'error',
          data: {
            status: 'failed',
            error: errorMessage,
          },
        });
      } finally {
        controller.close();
      }
    })();

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Pipeline API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

function calculateOverallProgress(state: PipelineState): number {
  const steps = Object.values(state.steps);
  const totalProgress = steps.reduce((sum, step) => sum + step.progress, 0);
  return Math.round(totalProgress / steps.length);
}