import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

// 生成可执行路由代码，避免 JSON.stringify 把函数写成字符串
function serializeRoute(route, indent = 2) {
  const space = " ".repeat(indent);
  const childSpace = " ".repeat(indent + 2);
  const parts = [];

  Object.entries(route).forEach(([key, value]) => {
    if (key === "component" && typeof value === "string") {
      parts.push(
        `${childSpace}component: () => import(${JSON.stringify(value)})`,
      );
      return;
    }

    if (key === "children" && Array.isArray(value)) {
      const childrenCode = value
        .map((child) => serializeRoute(child, indent + 4))
        .join(",\n");
      parts.push(`${childSpace}children: [\n${childrenCode}\n${childSpace}]`);
      return;
    }

    parts.push(`${childSpace}${key}: ${JSON.stringify(value)}`);
  });

  return `${space}{\n${parts.join(",\n")}\n${space}}`;
}

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.ts",
    useNew = true,
  } = options;

  let rootDir = process.cwd();
  let watchRootNormalized = "";

  function generateRoutesFile() {
    try {
      const pagesPath = path.resolve(rootDir, pagesDir);
      let routes = useNew
        ? generateRoutesNew(pagesPath, pagesPath)
        : generateRoutesOld(pagesPath, pagesPath);

      const routesCode = routes
        .map((route) => serializeRoute(route, 2))
        .join(",\n");
      const content = `// 本文件由 vite-plugin-auto-route 自动生成，请勿手动修改
        export const routes = [
        ${routesCode}
        ];
        `;

      const targetPath = path.resolve(rootDir, routesFile);
      const tempPath = `${targetPath}.${Date.now()}.tmp`;

      fs.writeFileSync(tempPath, content, "utf-8");
      fs.renameSync(tempPath, targetPath);

      console.log(
        `✅ [auto-route] 路由生成成功！共 ${routes.length} 条路由，已转换为动态导入`,
      );
    } catch (err) {
      console.error("❌ [auto-route] 生成失败:", err.message);
    }
  }

  return {
    name: "vite-plugin-auto-route",

    configResolved(config) {
      rootDir = config.root;
      watchRootNormalized = path
        .resolve(rootDir, pagesDir)
        .split(path.sep)
        .join("/")
        .toLowerCase();
      console.log("🚀 [auto-route] 插件已加载，监听目录:", watchRootNormalized);
    },

    configureServer(server) {
      console.log("🚀 [auto-route] dev server 已启动");
      generateRoutesFile();

      server.watcher.on("all", (event, filePath) => {
        const normalized = filePath.split(path.sep).join("/").toLowerCase();
        if (
          normalized.startsWith(watchRootNormalized) &&
          normalized.endsWith(".vue")
        ) {
          console.log(`📁 视图变更 (${event}): ${path.basename(filePath)}`);
          generateRoutesFile();
          server.ws.send({ type: "full-reload" });
        }
      });
    },

    handleHotUpdate(ctx) {
      const normalized = ctx.file.split(path.sep).join("/").toLowerCase();
      if (
        normalized.startsWith(watchRootNormalized) &&
        normalized.endsWith(".vue")
      ) {
        console.log(`🔄 HMR 变更: ${path.basename(ctx.file)}`);
        generateRoutesFile();
        ctx.server.ws.send({ type: "full-reload" });
        return [];
      }
    },

    buildStart() {
      generateRoutesFile();
    },
  };
}
