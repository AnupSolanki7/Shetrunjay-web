import type { Role } from "@/lib/auth";
import { layersForRole } from "@/lib/layers-mock";

export interface LayerFeature extends GeoJSON.Feature {
  properties: {
    id: number;
    name: string;
    layerId: string;
    group: string;
    attrs: Record<string, string | number | null>;
  };
}

export interface LayerCollection extends GeoJSON.FeatureCollection {
  features: LayerFeature[];
}

export class UnauthorizedError extends Error {}

function roleFromToken(token: string | null): Role | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { role_name: Role };
    return claims.role_name;
  } catch {
    return null;
  }
}

// Static demo build: no backend to call, so this resolves from the mock
// layer set instead of an HTTP request. token is null for an anonymous
// visitor — mirroring the real API, that resolves to the public role rather
// than being rejected.
export async function fetchLayers(token: string | null): Promise<LayerCollection> {
  return layersForRole(roleFromToken(token));
}
