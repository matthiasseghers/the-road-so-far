import type { ImageProvider, ImageSearchResult, ImageProviderPage } from './image-provider.js';

const PER_PAGE = 20;

// Unsplash Search API — https://unsplash.com/documentation#search-photos
// Unsplash guidelines require sending a User-Agent that identifies the app.
export const UnsplashProvider: ImageProvider = {
  id:    'unsplash',
  label: 'Unsplash',

  async search(query, page, apiKey, extra): Promise<ImageProviderPage> {
    const appName = extra?.['appName'] ?? 'The Road So Far';
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${PER_PAGE}`;
    const res = await fetch(url, {
      headers: {
        Authorization:    `Client-ID ${apiKey}`,
        'Accept-Version': 'v1',
        'User-Agent':     `${appName}/1.0`,
      },
    });
    if (!res.ok) throw new Error(`Unsplash API error: ${res.status}`);

    const data = await res.json() as {
      results: Array<{
        id:              string;
        urls:            { regular: string; full: string };
        description:     string | null;
        alt_description: string | null;
        user:            { name: string };
      }>;
      total_pages: number;
    };

    const photos: ImageSearchResult[] = data.results.map(p => ({
      id:           p.id,
      thumbUrl:     p.urls.regular,
      fullUrl:      p.urls.full,
      altText:      p.description ?? p.alt_description,
      attribution:  `Photo by ${p.user.name} on Unsplash`,
      photographer: p.user.name,
      provider:     'unsplash',
    }));

    return {
      photos,
      totalPages:  Math.max(1, data.total_pages),
      currentPage: page,
    };
  },
};
