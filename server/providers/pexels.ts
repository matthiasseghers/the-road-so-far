import type { ImageProvider, ImageSearchResult, ImageProviderPage } from './image-provider.js';

const PER_PAGE = 20;

// Pexels Photo Search API — https://www.pexels.com/api/documentation/
export const PexelsProvider: ImageProvider = {
  id:    'pexels',
  label: 'Pexels',

  async search(query, page, apiKey): Promise<ImageProviderPage> {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${PER_PAGE}`;
    const res = await fetch(url, {
      headers: { Authorization: apiKey },
    });
    if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);

    const data = await res.json() as {
      photos: Array<{
        id:               number;
        src:              { large: string; original: string };
        alt:              string | null;
        photographer:     string;
        photographer_url: string;
      }>;
      total_results: number;
    };

    const photos: ImageSearchResult[] = data.photos.map(p => ({
      id:           String(p.id),
      thumbUrl:     p.src.large,
      fullUrl:      p.src.original,
      altText:      p.alt,
      attribution:  `Photo by ${p.photographer} on Pexels`,
      photographer: p.photographer,
      provider:     'pexels',
    }));

    return {
      photos,
      totalPages:  Math.max(1, Math.ceil(data.total_results / PER_PAGE)),
      currentPage: page,
    };
  },
};
