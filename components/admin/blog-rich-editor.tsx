"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link2,
  Image as ImageIcon,
  Video,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Minus,
  RemoveFormatting,
  X,
  Check,
  Upload,
} from "lucide-react";

interface BlogRichEditorProps {
  value: string;
  onChange: (html: string) => void;
  onImageUpload?: (file: File) => Promise<string | null>;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-slate-200 mx-0.5 self-center shrink-0" />;
}

type ModalType = "link" | "image" | "youtube" | null;

function getYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export default function BlogRichEditor({ value, onChange, onImageUpload }: BlogRichEditorProps) {
  const [modal, setModal] = useState<ModalType>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, forceUpdate] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Underline,
      Highlight.configure({ multicolor: false }),
      TextStyle,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline cursor-pointer" },
      }),
      Image.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            "data-yt-id": { default: null },
            style: { default: null },
            title: { default: null },
          };
        },
      }).configure({
        HTMLAttributes: { class: "rounded-lg max-w-full h-auto my-4" },
      }),
      Placeholder.configure({
        placeholder: "Start writing your post content here…",
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none min-h-[400px] focus:outline-none px-5 py-4 text-slate-800 prose-headings:text-slate-900 prose-a:text-primary prose-blockquote:border-l-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-code:bg-slate-100 prose-code:rounded prose-code:px-1",
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      forceUpdate(n => n + 1);
    },
    onSelectionUpdate() {
      forceUpdate(n => n + 1);
    },
  });

  // Sync on initial load (edit mode)
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const openLinkModal = useCallback(() => {
    if (!editor) return;
    const existing = editor.getAttributes("link").href as string | undefined;
    const sel = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(sel.from, sel.to, "");
    setLinkUrl(existing ?? "");
    setLinkText(selectedText);
    setModal("link");
  }, [editor]);

  const applyLink = () => {
    if (!editor) return;
    if (!linkUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      if (linkText && editor.state.selection.empty) {
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${linkUrl}">${linkText}</a>`)
          .run();
      } else {
        editor.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
      }
    }
    setModal(null);
    setLinkUrl("");
    setLinkText("");
  };

  const applyImage = () => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl, alt: imageAlt || "Image" }).run();
    setModal(null);
    setImageUrl("");
    setImageAlt("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageUpload) return;
    setUploading(true);
    try {
      const url = await onImageUpload(file);
      if (url) setImageUrl(url);
    } finally {
      setUploading(false);
    }
  };

  const applyYoutube = () => {
    if (!editor || !youtubeUrl) return;
    const id = getYoutubeId(youtubeUrl);
    if (!id) {
      alert("Invalid YouTube URL. Please use a youtube.com/watch or youtu.be link.");
      return;
    }
    const embedHtml = `<img
      src="https://img.youtube.com/vi/${id}/hqdefault.jpg"
      data-yt-id="${id}"
      alt="YouTube video — click to remove"
      title="YouTube video — click thumbnail to remove"
      style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:0.75rem;border:3px solid #dc2626;cursor:pointer;display:block;margin:1rem 0;"
    />`;
    editor.chain().focus().insertContent(embedHtml).run();
    setModal(null);
    setYoutubeUrl("");
  };

  // Handle paste of image files directly into the editor
  const handleEditorPaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!editor || !onImageUpload) return;
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const url = await onImageUpload(file);
    if (url) {
      editor.chain().focus().setImage({ src: url, alt: "Pasted image" }).run();
    }
  }, [editor, onImageUpload]);

  // Handle clicks inside the editor content (for yt-embed delete)
  const handleEditorClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const ytImg = target.closest("img[data-yt-id]") as HTMLImageElement | null;
    if (!ytImg) return;
    if (window.confirm("Remove this YouTube video?")) {
      const ytId = ytImg.dataset.ytId;
      const currentHtml = editor?.getHTML() ?? "";
      const cleaned = currentHtml.replace(
        new RegExp(`<img[^>]*data-yt-id="${ytId}"[^>]*/?>`, "g"),
        ""
      );
      editor?.commands.setContent(cleaned);
      onChange(cleaned);
    }
  }, [editor, onChange]);

  const closeModal = () => {
    setModal(null);
    setLinkUrl("");
    setLinkText("");
    setImageUrl("");
    setImageAlt("");
    setYoutubeUrl("");
  };

  if (!editor) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Toolbar — sticky so it stays visible while scrolling */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-2 py-1.5 flex flex-wrap items-center gap-0.5 shadow-sm">
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1">
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold (Ctrl+B)">
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic (Ctrl+I)">
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline (Ctrl+U)">
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive("highlight")} title="Highlight">
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Inline Code">
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left">
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center">
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right">
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify">
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List">
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List">
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={openLinkModal} active={editor.isActive("link")} title="Insert Link">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setModal("image")} title="Insert Image">
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => setModal("youtube")} title="Embed YouTube Video">
          <Video className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal Divider">
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Clear Formatting">
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor */}
      <div onClick={handleEditorClick} onPaste={handleEditorPaste}>
        <EditorContent editor={editor} />
      </div>

      {/* Status bar */}
      <div className="border-t border-slate-100 px-4 py-1.5 flex items-center justify-between text-xs text-slate-400 bg-slate-50">
        <span>
          {editor.getText().length} characters · {editor.getText().trim().split(/\s+/).filter(Boolean).length} words
        </span>
        <span className="text-slate-300">Ctrl+Z undo · Ctrl+B bold · Ctrl+I italic</span>
      </div>

      {/* ── Modal Overlay ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onMouseDown={closeModal}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Link modal */}
            {modal === "link" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Link2 className="h-4 w-4" /> Insert Link</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">URL</label>
                    <input
                      autoFocus
                      type="url"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyLink()}
                      placeholder="https://example.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Link text <span className="text-slate-400">(optional — uses selected text if blank)</span></label>
                    <input
                      type="text"
                      value={linkText}
                      onChange={(e) => setLinkText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyLink()}
                      placeholder="Click here"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button type="button" onClick={applyLink} className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-1.5">
                    <Check className="h-4 w-4" /> Apply Link
                  </button>
                  {editor.isActive("link") && (
                    <button type="button" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); closeModal(); }} className="px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm hover:bg-red-100">
                      Remove
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Image modal */}
            {modal === "image" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Insert Image</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image URL</label>
                    <input
                      autoFocus
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {onImageUpload && (
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">— or upload a file —</label>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-slate-200 rounded-lg py-3 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700 flex items-center justify-center gap-2 transition-colors">
                        <Upload className="h-4 w-4" />
                        {uploading ? "Uploading…" : "Upload from computer"}
                      </button>
                    </div>
                  )}
                  {imageUrl && (
                    <img src={imageUrl} alt="preview" className="w-full h-32 object-cover rounded-lg border border-slate-200" />
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Alt text</label>
                    <input
                      type="text"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      placeholder="Describe the image"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>
                <button type="button" onClick={applyImage} disabled={!imageUrl} className="mt-5 w-full bg-slate-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <Check className="h-4 w-4" /> Insert Image
                </button>
              </>
            )}

            {/* YouTube modal */}
            {modal === "youtube" && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-900 flex items-center gap-2"><Video className="h-4 w-4" /> Embed YouTube Video</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">YouTube URL</label>
                    <input
                      autoFocus
                      type="url"
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyYoutube()}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                  {youtubeUrl && getYoutubeId(youtubeUrl) && (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={`https://img.youtube.com/vi/${getYoutubeId(youtubeUrl)}/hqdefault.jpg`}
                        alt="YouTube preview"
                        className="w-full aspect-video object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                          <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-slate-400">Accepts youtube.com/watch or youtu.be links. The video will display as a clickable thumbnail in the editor and as a full embed on the live blog post.</p>
                </div>
                <button type="button" onClick={applyYoutube} disabled={!youtubeUrl} className="mt-5 w-full bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
                  <Check className="h-4 w-4" /> Embed Video
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
