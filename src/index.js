import fs from "node:fs";
import path from "node:path";
import { generateRoutesNew, generateRoutesOld } from "./routeParse.mjs";

// 将路由对象序列化为可执行的 JS 代码
// 支持 component 转为动态导入函数，同时保留用户在 .meta.js 中定义的所有元数据
function serializeRouteRecord(route) {
  const { component, children, ...rest } = route;

  const fields = Object.entries(rest).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  );

  // 将组件路径序列化为真实动态导入函数
  if (typeof component === "string" && component.length > 0) {
    fields.push(`component: () => import(${JSON.stringify(component)})`);
  }

  // 递归处理子路由
  if (Array.isArray(children)) {
    const childrenCode = children
      .map(serializeRouteRecord)
      .join(",\n");
    fields.push(`children: [\n${childrenCode}\n]`);
  }

  return `{\n${fields.map((line) => `  ${line}`).join(",\n")}\n}`;
}

function serializeRoutes(routes) {
  const code = routes.map(serializeRouteRecord).join(",\n");
  return `[\n${code}\n]`;
}

export default function VitePluginAutoRoutes(options = {}) {
  const {
    pagesDir = "src/views",
    routesFile = "src/router/autoRoutes.js",
    useNew = true,
  } = options;

  return {
    name: "vite-plugin-auto-route",
    handleHotUpdate(config) {
      const pagesPath = path.resolve(config.root, pagesDir);
      const routes = useNew
        ? generateRoutesNew(pagesPath, pagesPath)
        : generateRoutesOld(pagesPath, pagesPath);

      const routesFileContent = `export const routes = ${serializeRoutes(routes)};\n`;

      fs.writeFileSync(
        path.resolve(config.root, routesFile),
        routesFileContent,
        "utf8",
      );
    },
  };
}
