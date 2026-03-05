import React from "react";

// Auto-discover all pages under src/pages
const pages = import.meta.glob("../pages/**/*.jsx");

export function lazyPage(componentName) {
  // Convention: componentName == file name (without extension) under src/pages
  const key = Object.keys(pages).find((p) => p.endsWith(`/pages/${componentName}.jsx`));
  if (!key) {
    // also try nested pages
    const key2 = Object.keys(pages).find((p) => p.endsWith(`/pages/${componentName}/${componentName}.jsx`));
    if (!key2) {
      throw new Error(`Page component not found for: ${componentName}`);
    }
    return React.lazy(async () => {
      const mod = await pages[key2]();
      return { default: mod.default };
    });
  }

  return React.lazy(async () => {
    const mod = await pages[key]();
    return { default: mod.default };
  });
}
