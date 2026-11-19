import { NextResponse } from 'next/server';
import { fetchLiveMatchesServer } from '../../../lib/liveFootball';

export async function GET() {
  try {
    const liveMatches = await fetchLiveMatchesServer();

    return NextResponse.json({
      success: true,
      source: 'ESPN Live Satellite Global Telemetry',
      timestamp: new Date().toISOString(),
      totalMatches: liveMatches.length,
      liveCount: liveMatches.filter((m) => m.status === 'LIVE' || m.status === 'HT').length,
      matches: liveMatches,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch live scores';
    console.error('Failed to fetch live soccer scoreboard:', err);
    return NextResponse.json(
      {
        success: false,
        error: message,
        matches: [],
      },
      { status: 503 }
    );
  }
}
