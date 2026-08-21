import L from 'leaflet';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Reason: Vite/webpack tree-shaking removes _getIconUrl from L.Icon.Default,
// which breaks the default marker rendering. mergeOptions re-points it to the
// bundled asset URLs. Called once per page; safe to import in multiple files.
export function patchLeafletDefaultIcon(): void {
  (L.Icon.Default.prototype as unknown as Record<string, unknown>)['_getIconUrl'] = undefined;
  L.Icon.Default.mergeOptions({ iconUrl: markerIconUrl, shadowUrl: markerShadowUrl });
}
