import type { ImageProvider, ImageSearchResult, ImageProviderPage } from './image-provider.js';

const PER_PAGE = 20;

// Pixabay API — https://pixabay.com/api/docs/
// Note: the API key is passed as a query parameter (Pixabay does not support header auth).
// Reason: safesearch=true ensures family-friendly results only.
export const PixabayProvider: ImageProvider = {
  id:    'pixabay',
  label: 'Pixabay',

  async search(query, page, apiKey): Promise<ImageProviderPage> {
    const url = [
      'https://pixabay.com/api/?',
      `key=${encodeURIComponent(apiKey)}`,
      `&q=${encodeURIComponent(query)}`,
      `&image_type=photo`,
      `&page=${page}`,
      `&per_page=${PER_PAGE}`,
      `&safesearch=true`,
    ].join('');

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Pixabay API error: ${res.status}`);

    const data = await res.json() as {
      hits: Array<{
        id:            number;
        webformatURL:  string;
        largeImageURL: string;
        tags:          string;
        user:          string;
      }>;
      totalHits: number;
    };

    const photos: ImageSearchResult[] = data.hits.map(p => ({
      id:           String(p.id),
      thumbUrl:     p.webformatURL,
      fullUrl:      p.largeImageURL,
      altText:      p.tags,
      attribution:  `Image by ${p.user} on Pixabay`,
      photographer: p.user,
      provider:     'pixabay',
    }));

    return {
      photos,
      totalPages:  Math.max(1, Math.ceil(data.totalHits / PER_PAGE)),
      currentPage: page,
    };
  },
};
