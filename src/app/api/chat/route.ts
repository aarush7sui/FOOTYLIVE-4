import { NextRequest, NextResponse } from 'next/server';
import { Content, ThinkingLevel } from '@google/genai';
import { ai, FOOTBALL_ONLY_SYSTEM_INSTRUCTION } from '../../../lib/gemini';
import { fetchLiveMatchesServer, formatLiveContextForBot } from '../../../lib/liveFootball';

interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

interface GroundingSource {
  title: string;
  url: string;
}

const ALLOWED_MODELS: Record<string, string> = {
  hydrogen: 'gemini-4-hydrogen',
  lite: 'gemini-3.1-flash-lite',
};

function sanitizeHistory(rawHistory: unknown): Content[] {
  if (!Array.isArray(rawHistory)) return [];

  const validTurns: ChatTurnInput[] = rawHistory
    .filter(
      (item): item is ChatTurnInput =>
        Boolean(item) &&
        typeof item === 'object' &&
        (item.role === 'user' || item.role === 'model') &&
        typeof item.text === 'string' &&
        item.text.trim().length > 0
    )
    .slice(-20);

  const firstUserIdx = validTurns.findIndex((t) => t.role === 'user');
  if (firstUserIdx === -1) return [];

  const sliced = validTurns.slice(firstUserIdx);
  const alternating: Content[] = [];

  for (const turn of sliced) {
    const expectedRole = alternating.length % 2 === 0 ? 'user' : 'model';
    if (turn.role === expectedRole) {
      alternating.push({
        role: turn.role,
        parts: [{ text: turn.text.trim() }],
      });
    }
  }

  if (alternating.length > 0 && alternating[alternating.length - 1].role === 'user') {
    alternating.pop();
  }

  return alternating;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets.',
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const mode = typeof body?.mode === 'string' ? body.mode : 'hydrogen';
    const activeMatchContext =
      typeof body?.activeMatchContext === 'string' ? body.activeMatchContext.trim() : '';
    const model = ALLOWED_MODELS[mode] || 'gemini-4-hydrogen';

    if (!message) {
      return NextResponse.json(
        { error: 'Please enter a football question before sending.' },
        { status: 400 }
      );
    }

    const history = sanitizeHistory(body?.history);

    // Fetch real-time ESPN scoreboard telemetry on every turn
    const liveMatches = await fetchLiveMatchesServer().catch(() => []);
    const liveTelemetryBlock = formatLiveContextForBot(liveMatches);

    const systemInstruction = [
      FOOTBALL_ONLY_SYSTEM_INSTRUCTION,
      '',
      '=== LIVE FOOTYLIVE ESPN TELEMETRY ===',
      liveTelemetryBlock,
      activeMatchContext ? `\nCURRENTLY OPEN MATCH IN USER VIEWPORT:\n${activeMatchContext}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const candidateModels =
      model === 'gemini-4-hydrogen'
        ? ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']
        : ['gemini-3.1-flash-lite'];

    let response;
    let activeModel = model;
    let lastError: unknown = null;

    for (const candidateModel of candidateModels) {
      activeModel = candidateModel;
      const config: {
        systemInstruction: string;
        tools: Array<{ googleSearch: Record<string, never> }>;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {
        systemInstruction,
        tools: [{ googleSearch: {} }],
      };

      if (candidateModel === 'gemini-4-hydrogen') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }

      const chat = ai.chats.create({
        model: candidateModel,
        history,
        config,
      });

      const maxAttempts = 3;
      let succeeded = false;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          response = await chat.sendMessage({ message });
          succeeded = true;
          break;
        } catch (callErr: unknown) {
          lastError = callErr;
          const status = (callErr as { status?: number })?.status;
          const isTransient = status === 503 || status === 500;
          if (!isTransient || attempt === maxAttempts) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
        }
      }

      if (succeeded) break;

      const errStatus = (lastError as { status?: number })?.status;
      if (errStatus !== 429 && errStatus !== 503) {
        throw lastError;
      }
    }

    if (!response) {
      throw lastError ?? new Error('Unable to reach Gemini right now.');
    }

    const reply = response?.text?.trim();

    if (!reply) {
      return NextResponse.json(
        { error: 'FOOTYBot received an empty response. Please try asking again.' },
        { status: 502 }
      );
    }

    // Extract Google Search grounding citations
    const metadata = response?.candidates?.[0]?.groundingMetadata;
    const rawChunks = metadata?.groundingChunks || [];
    const seenUrls = new Set<string>();
    const sources: GroundingSource[] = [];

    for (const chunk of rawChunks) {
      const uri = chunk?.web?.uri;
      const title = chunk?.web?.title;
      if (uri && !seenUrls.has(uri)) {
        seenUrls.add(uri);
        sources.push({
          title: title || new URL(uri).hostname.replace(/^www\./, ''),
          url: uri,
        });
      }
    }

    const searchQueries = Array.isArray(metadata?.webSearchQueries)
      ? metadata.webSearchQueries.filter((q): q is string => typeof q === 'string' && q.length > 0)
      : [];

    return NextResponse.json({
      reply,
      model: activeModel,
      sources: sources.slice(0, 6),
      searchQueries: searchQueries.slice(0, 4),
      liveMatchCount: liveMatches.length,
    });
  } catch (err: unknown) {
    const errObj = err as { status?: number; message?: string };
    const status = typeof errObj?.status === 'number' && errObj.status >= 400 ? errObj.status : 500;
    let message =
      errObj?.message || 'Unable to reach Gemini right now. Please try again in a moment.';

    try {
      const parsed = JSON.parse(message);
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      // Keep raw message if not JSON
    }

    if (status === 429) {
      message = `${message} Add or switch to a billing-enabled Gemini API key in Settings > Secrets to restore FOOTYBot quota.`;
    } else if (status === 403 || status === 400) {
      message = `${message} Check your GEMINI_API_KEY configuration in Settings > Secrets.`;
    }

    console.error('[api/chat] Gemini error:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
