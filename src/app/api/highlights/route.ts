import { NextRequest, NextResponse } from 'next/server';

interface EspnArticle {
  id?: string | number;
  headline?: string;
  description?: string;
  published?: string;
  byline?: string;
  images?: Array<{ url?: string }>;
  video?: Array<{ duration?: number }>;
  videos?: Array<{ duration?: number }>;
  categories?: Array<{ description?: string }>;
  links?: { web?: { href?: string } };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter') || 'ALL';

  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/news?limit=25', {
      next: { revalidate: 180 },
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 FOOTYLive/3.0',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: 'ESPN media feed unavailable', highlights: [] },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { articles?: EspnArticle[] };
    const articles = data.articles || [];

    const highlights = articles.map((article, idx) => {
      const video = article.video?.[0] || article.videos?.[0];
      const thumbnailUrl = article.images?.[0]?.url || '';
      const hasVideo = Boolean(video);
      const duration = video?.duration
        ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`
        : 'REPORT';
      const categoryDesc =
        article.categories?.find((c) => c.description)?.description || 'Global Football';

      const tag = hasVideo
        ? video?.duration && video.duration > 300
          ? 'EXTENDED'
          : 'ALL GOALS'
        : 'VIRAL';

      const publishedLabel = article.published
        ? new Date(article.published).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Latest';

      return {
        id: `espn-news-${article.id || idx}`,
        title: article.headline || 'Football Match Report',
        match: article.description || categoryDesc,
        tournament: categoryDesc,
        duration,
        thumbnailUrl,
        views: article.byline ? article.byline : 'ESPN FC Feed',
        date: publishedLabel,
        quality: hasVideo ? 'HD VIDEO' : 'LIVE NEWS',
        tag,
        author: article.byline || 'ESPN FC',
        url: article.links?.web?.href,
      };
    });

    const filtered =
      filter === 'ALL'
        ? highlights
        : highlights.filter((h) => h.tag === filter);

    return NextResponse.json({
      success: true,
      highlights: filtered,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch highlights';
    return NextResponse.json(
      { success: false, error: message, highlights: [] },
      { status: 503 }
    );
  }
}
