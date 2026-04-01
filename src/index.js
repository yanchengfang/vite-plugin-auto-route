import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

// 彻底修复版：强制把所有 component 字符串转为动态导入函数
function toDynamicImport(route) {
  if (!route || typeof route !== "object") return route;

  const newRoute = { ...route };

  // 处理当前节点的 component
  if (typeof newRoute.component === "string") {
    newRoute.component = `() => import("${newRoute.component}")`;
  }

  // 递归处理 children
  if (Array.isArray(newRoute.children)) {
    newRoute.children = newRoute.children.map(toDynamicImport);
  }

  return newRoute;
}

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.ts",
    useNew = true,
  } = options;

  function generateRoutesFile() {
    try {
      const root = process.cwd();
      const pagesPath = path.resolve(root, pagesDir);

      let routes = useNew
        ? generateRoutesNew(pagesPath, pagesPath)
        : generateRoutesOld(pagesPath, pagesPath);

      // 关键修复：强制转换所有 component 为动态导入
      routes = routes.map(toDynamicImport);

      const content = `// 本文件由 vite-plugin-auto-route 自动生成，请勿手动修改
export const routes = ${JSON.stringify(routes, null, 2).replace(
        /"component": " \(\) => import\((.+?)\)"(,?)/g,
        "component: () => import($1)$2",
      )}
;\n`;

      fs.writeFileSync(path.resolve(root, routesFile), content, "utf-8");

      console.log(
        `✅ [auto-route] 路由生成成功！共 ${routes.length} 条路由，已转换为动态导入`,
      );
    } catch (err) {
      console.error("❌ [auto-route] 生成失败:", err.message);
    }
  }

  return {
    name: "vite-plugin-auto-route",

    configureServer(server) {
      console.log("🚀 [auto-route] 插件已启动");
      generateRoutesFile();

      server.watcher.on("all", (event, filePath) => {
        if (
          filePath.includes(pagesDir) &&
          (filePath.endsWith(".vue") || filePath.endsWith(".meta.js"))
        ) {
          console.log(`📁 视图变更 (${event}): ${path.basename(filePath)}`);
          generateRoutesFile();
          server.ws.send({ type: "full-reload" });
        }
      });
    },

    buildStart() {
      generateRoutesFile();
    },
  };
}
