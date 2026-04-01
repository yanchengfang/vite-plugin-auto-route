import path from "node:path";
import fs from "node:fs";

function toKebabCase(input) {
  return input
    .replace(/_/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();
}

function stripViewSuffix(name) {
  return name.replace(/view$/i, "");
}

function normalizeSegment(name) {
  return toKebabCase(stripViewSuffix(name));
}

function isLayoutFile(baseName) {
  const n = baseName.toLowerCase();
  return n === "index" || n === "indexview" || n === "homeview";
}

function resolveImportPath(viewsRootDir, vueFileAbsPath) {
  const rel = path
    .relative(viewsRootDir, vueFileAbsPath)
    .split(path.sep)
    .join("/");
  return `/src/views/${rel}`;
}

// 读取同目录下的 .meta.js 文件，返回元数据对象
function loadRouteMeta(vueFilePath) {
  const metaFilePath = vueFilePath.replace(/\.vue$/i, '.meta.js');
  if (fs.existsSync(metaFilePath)) {
    try {
      // 使用 import() 动态加载，避免 CommonJS require 在 ESM 项目中的问题
      return require(metaFilePath); // 兼容当前插件运行环境
    } catch (e) {
      console.warn(`[vite-plugin-auto-route] 加载元数据失败: ${metaFilePath}`, e.message);
      return {};
    }
  }
  return {};
}

function defaultChildSegmentForDir(dirName) {
  return normalizeSegment(`${dirName}view`);
}

function walkViewsDir(currentDir, viewsRootDir, dirName, isTopLevel) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  const pages = [];
  const subdirs = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      subdirs.push(entry.name);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".vue")) continue;
    pages.push(entry.name);
  }

  const layoutFile = pages.find((f) => isLayoutFile(f.replace(/\.vue$/i, "")));
  const pageFiles = pages.filter((f) => f !== layoutFile);

  const children = [];

  for (const fileName of pageFiles) {
    const baseName = fileName.replace(/\.vue$/i, "");
    const pageSegment = normalizeSegment(baseName);
    const isDefault = pageSegment === defaultChildSegmentForDir(dirName);

    const componentAbs = path.resolve(currentDir, fileName);
    const importPath = resolveImportPath(viewsRootDir, componentAbs);

    children.push({
      path: isDefault ? "" : pageSegment,
      name: `${dirName}${baseName}`,
      component: importPath,
      ...loadRouteMeta(componentAbs),
    });
  }

  for (const subdirName of subdirs) {
    const subdirAbs = path.resolve(currentDir, subdirName);
    children.push(...walkViewsDir(subdirAbs, viewsRootDir, subdirName, false));
  }

  const segment = normalizeSegment(dirName);
  const routePath = isTopLevel ? `/${segment}` : segment;
  const route = {
    path: routePath,
    name: `${dirName}Home`,
    children,
  };

  if (layoutFile) {
    const layoutAbs = path.resolve(currentDir, layoutFile);
    const importPath = resolveImportPath(viewsRootDir, layoutAbs);
    route.component = importPath;
    // 布局文件也支持元数据
    Object.assign(route, loadRouteMeta(layoutAbs));
  }

  return [route];
}

export function generateRoutesNew(viewsDir, basePath) {
  const viewsRootDir = path.resolve(basePath);
  const pagesRootDir = path.resolve(viewsDir);

  const entries = fs.readdirSync(pagesRootDir, { withFileTypes: true });

  const rootRoutes = [];

  for (const entry of entries) {
    const fullPath = path.resolve(pagesRootDir, entry.name);

    if (entry.isDirectory()) {
      rootRoutes.push(
        ...walkViewsDir(fullPath, viewsRootDir, entry.name, true),
      );
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".vue")) continue;

    const baseName = entry.name.replace(/\.vue$/i, "");
    const segment = normalizeSegment(baseName);
    const importPath = resolveImportPath(viewsRootDir, fullPath);

    if (segment === "home") {
      rootRoutes.push({
        path: "/",
        name: "Home",
        component: importPath,
        ...loadRouteMeta(fullPath),
      });
      continue;
    }

    rootRoutes.push({
      path: `/${segment}`,
      name: baseName,
      component: importPath,
      ...loadRouteMeta(fullPath),
    });
  }

  return rootRoutes;
}

export function generateRoutesOld(dir, basePath) {
  const files = fs.readdirSync(dir);
  return files.flatMap((file) => {
    const fullPath = path.resolve(dir, file);
    const relativePath = path.relative(basePath, fullPath);
    if (fs.statSync(fullPath).isDirectory()) {
      return generateRoutesOld(fullPath, basePath);
    }
    if (file.endsWith(".vue")) {
      const routePath = relativePath
        .replace(/\\/g, "/")
        .replace(/\.vue$/i, "")
        .replace(/\/index$/i, "")
        .replace(/\/_/g, "/:");
      const importPath = `/src/views/${relativePath.replace(/\\/g, "/")}`;

      const parts = routePath.split("/").filter(Boolean);
      if (
        parts.length > 1 &&
        parts[parts.length - 1] === parts[parts.length - 2]
      ) {
        parts.pop();
      }
      const finalPath = `/${parts.join("/").toLowerCase()}`;
      const metaFilePath = fullPath.replace(".vue", ".meta.js");
      const meta = fs.existsSync(metaFilePath) ? require(metaFilePath) : {};

      return [
        {
          path: finalPath,
          component: importPath,
          ...meta,
        },
      ];
    }
    return [];
  });
}
