// Routing utilities — pure helpers that operate on cached leg/mode data.
// Lives in utils/ (not domain/) so server-side code (router.ts) can import it
// without pulling in React-adjacent domain module graph.

export { findLegMode } from '@/domain/RouteLeg';
