import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

// 将路由对象序列化为可执行的 JS 代码
// 关键修复：正确处理 component 为动态导入函数，并保持代码格式美观
function serializeRouteRecord(route) {
  if (!route || typeof route !== 'object') return '{}';

  const { component, children, ...rest } = route;
  const fields = [];

  // 处理普通字段（包括 meta 等元数据）
  Object.entries(rest).forEach(([key, value]) => {
    fields.push(`${key}: ${JSON.stringify(value)}`);
  });

  // 关键：将字符串路径转为真正的动态导入函数
  if (typeof component === "string" && component.length > 0) {
    fields.push(`component: () => import(${JSON.stringify(component)})`);
  }

  // 递归处理 children
  if (Array.isArray(children) && children.length > 0) {
    const childrenCode = children
      .map(serializeRouteRecord)
      .join(",\n    ");
    fields.push(`children: [\n    ${childrenCode}\n  ]`);
  }

  const content = fields.join(',\n  ');
  return `{\n  ${content}\n}`;
}

function serializeRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return '[]';
  }
  const code = routes
    .map(serializeRouteRecord)
    .join(",\n");
  return `[\n${code}\n]`;
}

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.ts",
    useNew = true,
  } = options;

  // 生成路由文件（供外部调用）
  function generateRoutesFile(root: string) {
    const pagesPath = path.resolve(root, pagesDir);
    const routes = useNew
      ? generateRoutesNew(pagesPath, pagesPath)
      : generateRoutesOld(pagesPath, pagesPath);

    const routesFileContent = `// 本文件由 vite-plugin-auto-route 自动生成，请勿手动修改
export const routes = ${serializeRoutes(routes)};\n`;

    const targetPath = path.resolve(root, routesFile);
    fs.writeFileSync(targetPath, routesFileContent, "utf8");
    console.log(`[vite-plugin-auto-route] 路由文件已生成 → ${routesFile}`);
  }

  return {
    name: "vite-plugin-auto-route",

    // 开发服务器启动时生成路由
    configureServer(server) {
      generateRoutesFile(server.config.root);
    },

    // 构建时也生成一次路由
    buildStart() {
      generateRoutesFile(process.cwd());
    },

    // 文件变化时热更新路由
    handleHotUpdate({ file, server }) {
      if (file.includes(pagesDir) && (file.endsWith('.vue') || file.endsWith('.meta.js'))) {
        console.log(`[vite-plugin-auto-route] 检测到视图文件变化: ${file}`);
        generateRoutesFile(server.config.root);
        // 触发页面刷新
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}
