import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeBlogHtml } from "../lib/sanitize-blog-html";

test("blog HTML strips active content and unsafe protocols while retaining formatting", () => {
  const clean = sanitizeBlogHtml('<h2 onclick="steal()">Title</h2><script>alert(1)</script><a href="javascript:alert(1)">bad</a><img src="https://images.example/a.jpg" onerror="steal()"><strong>Safe</strong>');
  assert.match(clean, /<h2>Title<\/h2>/);
  assert.doesNotMatch(clean, /script|onclick|onerror|javascript:/i);
  assert.match(clean, /<strong>Safe<\/strong>/);
});

test("blog HTML permits only supported YouTube iframe hosts", () => {
  const clean = sanitizeBlogHtml('<iframe src="https://www.youtube-nocookie.com/embed/abcdefghijk"></iframe><iframe src="https://evil.example/embed/x"></iframe>');
  assert.match(clean, /youtube-nocookie\.com/);
  assert.doesNotMatch(clean, /evil\.example/);
});
