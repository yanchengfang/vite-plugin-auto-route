import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

function serializeValue(value) {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return value;
}

// 核心序列化函数 - 确保 component 变成 () => import()
function serializeRoute(route) {
  const parts = [];

  // 处理 path, name, meta 等字段
  if (route.path) parts.push(`path: ${serializeValue(route.path)}`);
  if (route.name) parts.push(`name: ${serializeValue(route.name)}`);
  if (route.meta) parts.push(`meta: ${JSON.stringify(route.meta)}`);

  // 关键：component 转为动态导入
  if (typeof route.component === "string") {
    parts.push(`component: () => import(${JSON.stringify(route.component)})`);
  }

  // 递归处理 children
  if (Array.isArray(route.children)) {
    const childrenStr = route.children.map(serializeRoute).join(",\n    ");
    parts.push(`children: [\n    ${childrenStr}\n  ]`);
  }

  return `{\n  ${parts.join(",\n  ")}\n}`;
}

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.ts",
    useNew = true,
  } = options;

  function generate() {
    const pagesPath = path.resolve(process.cwd(), pagesDir);
    const routes = useNew
      ? generateRoutesNew(pagesPath, pagesPath)
      : generateRoutesOld(pagesPath, pagesPath);

    const content = `// 本文件由 vite-plugin-auto-route 自动生成，请勿手动修改
export const routes = ${routes.map(serializeRoute).join(",\n")};
`;

    fs.writeFileSync(path.resolve(process.cwd(), routesFile), content, "utf-8");
    console.log(
      `✅ [auto-route] 成功生成 ${routes.length} 条路由 (含动态 import)`,
    );
  }

  return {
    name: "vite-plugin-auto-route",

    configureServer(server) {
      console.log("🚀 [auto-route] 插件启动 - 监听视图目录");
      generate();
      server.watcher.on("all", (event, fp) => {
        if (fp.includes(pagesDir)) {
          console.log(`📁 文件变动 (${event}): ${path.basename(fp)}`);
          generate();
          server.ws.send({ type: "full-reload" });
        }
      });
    },

    buildStart() {
      generate();
    },
  };
}
