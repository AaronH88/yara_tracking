import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../..");

function readFile(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf-8");
}

describe("manifest.json", () => {
  const manifest = JSON.parse(readFile("public/manifest.json"));

  it("has required PWA fields", () => {
    expect(manifest.name).toBe("Baby Tracker");
    expect(manifest.short_name).toBe("Baby");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("has background_color and theme_color", () => {
    expect(manifest.background_color).toBe("#0f172a");
    expect(manifest.theme_color).toBe("#6366f1");
  });

  it("has icons array with 192x192 and 512x512 entries", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    const sizes = manifest.icons.map((i) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
  });

  it("each icon has src, sizes, and type", () => {
    for (const icon of manifest.icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBe("image/png");
    }
  });

  it("icon src paths point to files that exist in public/", () => {
    for (const icon of manifest.icons) {
      // src like "/icon-192.png" → "public/icon-192.png"
      const filePath = resolve(ROOT, "public", icon.src.replace(/^\//, ""));
      expect(existsSync(filePath)).toBe(true);
    }
  });
});

describe("index.html meta tags", () => {
  const html = readFile("index.html");

  it("has viewport meta with viewport-fit=cover", () => {
    expect(html).toMatch(
      /name="viewport"[^>]*content="[^"]*viewport-fit=cover[^"]*"/,
    );
  });

  it("has apple-mobile-web-app-capable meta tag", () => {
    expect(html).toMatch(
      /name="apple-mobile-web-app-capable"[^>]*content="yes"/,
    );
  });

  it("has theme-color meta for light scheme", () => {
    expect(html).toMatch(
      /name="theme-color"[^>]*content="#6366f1"[^>]*media="\(prefers-color-scheme:\s*light\)"/,
    );
  });

  it("has theme-color meta for dark scheme", () => {
    expect(html).toMatch(
      /name="theme-color"[^>]*content="#0f172a"[^>]*media="\(prefers-color-scheme:\s*dark\)"/,
    );
  });

  it("links to manifest.json", () => {
    expect(html).toMatch(/rel="manifest"[^>]*href="\/manifest\.json"/);
  });

  it("links to apple-touch-icon", () => {
    expect(html).toMatch(/rel="apple-touch-icon"[^>]*href="[^"]+"/);
  });

  it("links to a favicon", () => {
    expect(html).toMatch(/rel="icon"[^>]*href="[^"]+"/);
  });
});

describe("icon files", () => {
  it("icon.svg exists in public/", () => {
    expect(existsSync(resolve(ROOT, "public/icon.svg"))).toBe(true);
  });

  it("icon-192.png exists in public/", () => {
    expect(existsSync(resolve(ROOT, "public/icon-192.png"))).toBe(true);
  });

  it("icon-512.png exists in public/", () => {
    expect(existsSync(resolve(ROOT, "public/icon-512.png"))).toBe(true);
  });

  it("icon.svg is valid SVG", () => {
    const svg = readFile("public/icon.svg");
    expect(svg).toMatch(/<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/<\/svg>/);
  });

  it("icon-192.png is a valid PNG (has PNG signature)", () => {
    const buf = readFileSync(resolve(ROOT, "public/icon-192.png"));
    // PNG magic bytes: 137 80 78 71
    expect(buf[0]).toBe(137);
    expect(buf[1]).toBe(80);
    expect(buf[2]).toBe(78);
    expect(buf[3]).toBe(71);
  });

  it("icon-512.png is a valid PNG (has PNG signature)", () => {
    const buf = readFileSync(resolve(ROOT, "public/icon-512.png"));
    expect(buf[0]).toBe(137);
    expect(buf[1]).toBe(80);
    expect(buf[2]).toBe(78);
    expect(buf[3]).toBe(71);
  });

  it("icon-512.png is larger than icon-192.png", () => {
    const small = readFileSync(resolve(ROOT, "public/icon-192.png"));
    const large = readFileSync(resolve(ROOT, "public/icon-512.png"));
    expect(large.length).toBeGreaterThan(small.length);
  });
});

describe("manifest.json edge cases", () => {
  const manifest = JSON.parse(readFile("public/manifest.json"));

  it("display is exactly 'standalone' not 'browser' or other values", () => {
    expect(manifest.display).not.toBe("browser");
    expect(manifest.display).not.toBe("minimal-ui");
    expect(manifest.display).toBe("standalone");
  });

  it("start_url is '/' not empty or undefined", () => {
    expect(manifest.start_url).toBeDefined();
    expect(manifest.start_url).not.toBe("");
    expect(manifest.start_url).toBe("/");
  });

  it("short_name is short enough for home screen label (max 12 chars)", () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it("icons include purpose field", () => {
    for (const icon of manifest.icons) {
      expect(icon.purpose).toBeTruthy();
    }
  });
});
