import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.js",
    useNew = true,
  } = options;

  return {
    name: "vite-plugin-auto-route",
    configResolved(config) {
      const pagesPath = path.resolve(config.root, pagesDir);
      const routes = useNew
        ? generateRoutesNew(pagesPath, pagesPath)
        : generateRoutesOld(pagesPath, pagesPath);

      const routesFileContent = `export const routes = ${JSON.stringify(routes, null, 2)};\n`;

      fs.writeFileSync(
        path.resolve(config.root, routesFile),
        routesFileContent, 
        "utf8",
      );
    },
  };
}
