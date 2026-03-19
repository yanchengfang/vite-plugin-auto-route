import type { Plugin } from 'vite';

export interface VitePluginAutoRouteOptions {
  pagesDir?: string;
  routesFile?: string;
  useNew?: boolean;
}

export type AutoRouteMeta = Record<string, unknown>;

export interface AutoRouteRecord {
  path: string;
  component?: string;
  name?: string;
  children?: AutoRouteRecord[];
  meta?: AutoRouteMeta;
  [key: string]: unknown;
}

export default function VitePluginAutoRoutes(
  options?: VitePluginAutoRouteOptions
): Plugin;
