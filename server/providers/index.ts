export type { ImageProvider, ImageSearchResult, ImageProviderPage } from './image-provider.js';

import type { ImageProvider } from './image-provider.js';
import { PexelsProvider }   from './pexels.js';
import { UnsplashProvider } from './unsplash.js';
import { PixabayProvider }  from './pixabay.js';

export { PexelsProvider }   from './pexels.js';
export { UnsplashProvider } from './unsplash.js';
export { PixabayProvider }  from './pixabay.js';

// Registry — order determines display order in the UI.
export const IMAGE_PROVIDERS: ImageProvider[] = [
  PexelsProvider,
  UnsplashProvider,
  PixabayProvider,
];

// Reason: each provider has a distinct set of allowed download hostnames.
// Validated server-side before fetching to prevent SSRF.
export const ALLOWED_IMAGE_HOSTS: Record<string, string[]> = {
  pexels:   ['images.pexels.com', 'www.pexels.com'],
  unsplash: ['images.unsplash.com'],
  pixabay:  ['cdn.pixabay.com', 'pixabay.com'],
};
