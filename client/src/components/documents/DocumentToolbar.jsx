import { useEffect, useRef, useState } from "react";
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code2,
  Minus,
  Link2,
  Subscript,
  Superscript,
} from "lucide-react";
import { promptForLink } from "../../lib/tiptapLink.js";

const TEXT_COLORS = ["#1E293B", "#DC2626", "#D97706", "#16A34A", "#2563EB", "#7C3AED"];
const HIGHLIGHT_COLORS = ["#FEF08A", "#BBF7D0", "#BFDBFE", "#FBCFE8", "#FED7AA"];

function ToolButton({ Icon, title, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none ${
        active ? "bg-brand-50 text-brand-600" : "text-ink-500 hover:bg-ink-100 hover:text-ink-800"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function Divider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-ink-200" />;
}

function ColorPickerButton({ Icon, title, colors, activeColor, onPick, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label={title}
        className="flex h-8 w-8 flex-col items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-800"
      >
        <Icon className="h-4 w-4" />
        <span className="mt-0.5 h-0.5 w-4 rounded-full" style={{ backgroundColor: activeColor || "transparent" }} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1.5 shadow-panel">
          {onClear && (
            <button
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              title="Clear"
              aria-label="Clear color"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-ink-300 text-ink-400 hover:border-ink-400"
            >
              <span className="h-px w-3 rotate-45 bg-ink-400" />
            </button>
          )}
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => {
                onPick(c);
                setOpen(false);
              }}
              title={c}
              aria-label={`Color ${c}`}
              className="h-5 w-5 shrink-0 rounded-full ring-offset-1 hover:ring-2 hover:ring-ink-300"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentToolbar({ editor }) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-ink-200 bg-white px-3 py-2 print:hidden">
      <ToolButton Icon={Undo2} title="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()} />
      <ToolButton Icon={Redo2} title="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()} />

      <Divider />

      <ToolButton Icon={Bold} title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
      <ToolButton Icon={Italic} title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <ToolButton
        Icon={Underline}
        title="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolButton
        Icon={Strikethrough}
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />
      <ToolButton Icon={Code} title="Inline code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} />
      <ToolButton
        Icon={Subscript}
        title="Subscript"
        active={editor.isActive("subscript")}
        onClick={() => editor.chain().focus().toggleSubscript().run()}
      />
      <ToolButton
        Icon={Superscript}
        title="Superscript"
        active={editor.isActive("superscript")}
        onClick={() => editor.chain().focus().toggleSuperscript().run()}
      />

      <Divider />

      <ToolButton
        Icon={Heading1}
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolButton
        Icon={Heading2}
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolButton
        Icon={Heading3}
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />

      <Divider />

      <ColorPickerButton
        Icon={Palette}
        title="Text color"
        colors={TEXT_COLORS}
        activeColor={editor.getAttributes("textStyle").color}
        onPick={(c) => editor.chain().focus().setColor(c).run()}
        onClear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorPickerButton
        Icon={Highlighter}
        title="Highlight"
        colors={HIGHLIGHT_COLORS}
        activeColor={editor.getAttributes("highlight").color}
        onPick={(c) => editor.chain().focus().toggleHighlight({ color: c }).run()}
        onClear={() => editor.chain().focus().unsetHighlight().run()}
      />

      <Divider />

      <ToolButton
        Icon={AlignLeft}
        title="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      />
      <ToolButton
        Icon={AlignCenter}
        title="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      />
      <ToolButton
        Icon={AlignRight}
        title="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      />
      <ToolButton
        Icon={AlignJustify}
        title="Justify"
        active={editor.isActive({ textAlign: "justify" })}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
      />

      <Divider />

      <ToolButton Icon={List} title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <ToolButton
        Icon={ListOrdered}
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolButton Icon={ListChecks} title="Task list" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()} />

      <Divider />

      <ToolButton Icon={Quote} title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
      <ToolButton Icon={Code2} title="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
      <ToolButton Icon={Minus} title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      <ToolButton Icon={Link2} title="Link" active={editor.isActive("link")} onClick={() => promptForLink(editor)} />
    </div>
  );
}
