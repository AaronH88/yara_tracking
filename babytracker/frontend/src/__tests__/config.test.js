import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("vite.config.js", () => {
  const configContent = readFileSync(
    resolve(__dirname, "../../vite.config.js"),
    "utf-8",
  );

  it("proxies /api to localhost:8000", () => {
    expect(configContent).toContain('"/api"');
    expect(configContent).toContain("http://localhost:8000");
  });

  it("includes the react plugin", () => {
    expect(configContent).toContain("react()");
  });
});

describe("tailwind.config.js", () => {
  const configContent = readFileSync(
    resolve(__dirname, "../../tailwind.config.js"),
    "utf-8",
  );

  it("uses class-based dark mode", () => {
    expect(configContent).toMatch(/darkMode:\s*["']class["']/);
  });

  it("includes src files in content paths", () => {
    expect(configContent).toContain("./src/**/*.{js,jsx}");
  });

  it("includes index.html in content paths", () => {
    expect(configContent).toContain("./index.html");
  });
});

describe("index.css", () => {
  const cssContent = readFileSync(
    resolve(__dirname, "../index.css"),
    "utf-8",
  );

  it("imports tailwind base directive", () => {
    expect(cssContent).toContain("@tailwind base");
  });

  it("imports tailwind components directive", () => {
    expect(cssContent).toContain("@tailwind components");
  });

  it("imports tailwind utilities directive", () => {
    expect(cssContent).toContain("@tailwind utilities");
  });

  it("sets a system sans-serif font family", () => {
    expect(cssContent).toContain("font-family");
    expect(cssContent).toMatch(/(-apple-system|system-ui)/);
    expect(cssContent).toContain("sans-serif");
  });
});
