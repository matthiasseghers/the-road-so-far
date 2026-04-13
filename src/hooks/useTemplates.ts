import { useState, useEffect } from 'react';
import { api } from '@/db/api-client';

interface UseTemplatesReturn {
  categories: string[];
  isLoading: boolean;
}

export function useTemplates(): UseTemplatesReturn {
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    api.get<string[]>('/checklist-templates/categories')
      .then(data => { setCategories(data); setIsLoading(false); })
      .catch(() => { setIsLoading(false); });
  }, []);

  return { categories, isLoading };
}
