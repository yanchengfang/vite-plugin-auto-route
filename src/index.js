import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

// 最终稳定版：确保 component 被正确转为动态导入函数
function serializeRouteRecord(route) {
  if (!route || typeof route !== "object") return "{}";

  const fields = [];

  // 1. 先处理 component（最重要）
  if (typeof route.component === "string" && route.component.length > 0) {
    fields.push(`component: () => import(${JSON.stringify(route.component)})`);
  }

  // 2. 处理其他字段（包括 meta、name、path 等）
  Object.entries(route).forEach(([key, value]) => {
    if (key === "component") return; // 已处理过
    if (key === "children") return; // 后面单独处理

    fields.push(`${key}: ${JSON.stringify(value)}`);
  });

  // 3. 处理 children（递归）
  if (Array.isArray(route.children) && route.children.length > 0) {
    const childrenCode = route.children
      .map(serializeRouteRecord)
      .join(",\n    ");
    fields.push(`children: [\n    ${childrenCode}\n  ]`);
  }

  const content = fields.join(",\n  ");
  return `{\n  ${content}\n}`;
}

function serializeRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return "[]";
  }
  const code = routes.map(serializeRouteRecord).join(",\n");
  return `[\n${code}\n]`;
}

// ==================== 插件主体 ====================

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.ts",
    useNew = true,
  } = options;

  function generateRoutesFile(root) {
    try {
      const pagesPath = path.resolve(root, pagesDir);
      const routes = useNew
        ? generateRoutesNew(pagesPath, pagesPath)
        : generateRoutesOld(pagesPath, pagesPath);

      const routesFileContent = `// 本文件由 vite-plugin-auto-route 自动生成，请勿手动修改
export const routes = ${serializeRoutes(routes)};\n`;

      const targetPath = path.resolve(root, routesFile);
      fs.writeFileSync(targetPath, routesFileContent, "utf8");
      console.log(
        `✅ [vite-plugin-auto-route] 路由文件已更新 → ${routesFile} (共 ${routes.length} 条路由)`,
      );
    } catch (error) {
      console.error("❌ [vite-plugin-auto-route] 生成路由失败:", error.message);
    }
  }

  return {
    name: "vite-plugin-auto-route",

    configureServer(server) {
      console.log(
        "🚀 [vite-plugin-auto-route] 插件已启动，监听 src/views 目录...",
      );
      generateRoutesFile(server.config.root);

      server.watcher.on("all", (event, filePath) => {
        if (
          filePath.includes(pagesDir) &&
          (filePath.endsWith(".vue") || filePath.endsWith(".meta.js"))
        ) {
          console.log(
            `📁 [vite-plugin-auto-route] 检测到 ${event}: ${path.basename(filePath)}`,
          );
          generateRoutesFile(server.config.root);
          server.ws.send({ type: "full-reload" });
        }
      });
    },

    buildStart() {
      generateRoutesFile(process.cwd());
    },
  };
}
