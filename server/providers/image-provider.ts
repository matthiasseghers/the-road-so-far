// Shared interfaces for image search providers (Pexels, Unsplash, Pixabay).

export interface ImageSearchResult {
  id:           string;
  thumbUrl:     string;  // medium-resolution URL for display
  fullUrl:      string;  // highest-resolution URL for download
  altText:      string | null;
  attribution:  string;  // e.g. "Photo by Jane on Pexels"
  photographer: string;
  provider:     string;  // 'pexels' | 'unsplash' | 'pixabay'
}

export interface ImageProviderPage {
  photos:      ImageSearchResult[];
  totalPages:  number;
  currentPage: number;
}

export interface ImageProvider {
  id:    string;
  label: string;
  /**
   * Search for photos.
   * @param query   - Search terms.
   * @param page    - 1-based page number.
   * @param apiKey  - Provider API key.
   * @param extra   - Optional provider-specific config (e.g. { appName } for Unsplash).
   */
  search: (
    query:   string,
    page:    number,
    apiKey:  string,
    extra?:  Record<string, string>,
  ) => Promise<ImageProviderPage>;
}
