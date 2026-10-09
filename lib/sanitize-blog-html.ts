import sanitizeHtml from "sanitize-html";

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "pre", "code",
      "h1", "h2", "h3", "h4", "ul", "ol", "li", "a", "img", "figure", "figcaption",
      "div", "span", "table", "thead", "tbody", "tr", "th", "td", "hr", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      div: ["class", "data-yt-id", "style"],
      span: ["class", "style"],
      iframe: ["src", "title", "frameborder", "allow", "allowfullscreen", "style"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
    allowProtocolRelative: false,
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb(a)?\([0-9 ,.]+\)$/],
        "text-align": [/^(left|right|center|justify)$/],
      },
      div: {
        position: [/^relative$/], width: [/^100%$/], "padding-bottom": [/^56\.25%$/],
        "border-radius": [/^[0-9.]+(rem|px)$/], overflow: [/^hidden$/], margin: [/^[0-9. ]+(rem|px) [0-9. ]+(rem|px)$/],
      },
      iframe: {
        position: [/^absolute$/], inset: [/^0$/], width: [/^100%$/], height: [/^100%$/], border: [/^0$/],
      },
    },
    transformTags: {
      a: (_tag, attributes) => ({ tagName: "a", attribs: { ...attributes, rel: "noopener noreferrer" } }),
    },
  });
}
