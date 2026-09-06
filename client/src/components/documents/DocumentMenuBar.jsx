import { useEffect, useRef, useState } from "react";
import {
  FilePlus,
  Copy,
  Pencil,
  Trash2,
  Printer,
  FileDown,
  FileText,
  FileCode,
  Undo2,
  Redo2,
  SquareDashedMousePointer,
  ClipboardPaste,
  Search,
  Maximize2,
  Minimize2,
  LayoutGrid,
  Image as ImageIcon,
  Table as TableIcon,
  Link2,
  Minus,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  IndentIncrease,
  IndentDecrease,
  RemoveFormatting,
  Hash,
  Info,
  List,
  ListOrdered,
  ListChecks,
  Check,
  ChevronRight,
  Columns2,
  Columns3,
  Lock,
} from "lucide-react";
import { promptForLink } from "../../lib/tiptapLink.js";
import TableGridPicker from "./TableGridPicker.jsx";

const MOD = typeof navigator !== "undefined" && /Mac/.test(navigator.platform) ? "⌘" : "Ctrl";

function MenuButton({ label, isOpen, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`rounded px-2.5 py-1 text-sm transition-colors ${isOpen ? "bg-ink-100 text-ink-900" : "text-ink-600 hover:bg-ink-50"}`}
    >
      {label}
    </button>
  );
}

function Item({ Icon, label, shortcut, onClick, disabled, active }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm disabled:opacity-40 disabled:pointer-events-none ${
        active ? "bg-brand-50 text-brand-700" : "text-ink-600 hover:bg-ink-50"
      }`}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-ink-400" /> : <span className="w-3.5 shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && <span className="shrink-0 text-xs text-ink-300">{shortcut}</span>}
      {active && !Icon && <Check className="h-3.5 w-3.5 shrink-0 text-brand-600" />}
    </button>
  );
}

function Sep() {
  return <div className="my-1 h-px bg-ink-100" />;
}

export default function DocumentMenuBar({
  editor,
  onNew,
  onMakeCopy,
  onRename,
  onDelete,
  onDownload,
  onPrint,
  onFindReplace,
  onWordCount,
  onDetails,
  onAccess,
  onInsertImage,
  fullscreen,
  onToggleFullscreen,
  pageless,
  onTogglePageless,
  pageSize,
  onSetPageSize,
  columns,
  onSetColumns,
}) {
  const [openMenu, setOpenMenu] = useState(null);
  const [tableFlyoutOpen, setTableFlyoutOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!openMenu) return;
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpenMenu(null);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  useEffect(() => {
    if (openMenu !== "Insert") setTableFlyoutOpen(false);
  }, [openMenu]);

  function run(fn) {
    return () => {
      fn?.();
      setOpenMenu(null);
    };
  }

  function cmd(fn) {
    return () => {
      if (editor) fn(editor.chain().focus()).run();
      setOpenMenu(null);
    };
  }

  async function pasteWithoutFormatting() {
    setOpenMenu(null);
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch {
      // Clipboard read blocked (permissions/browser) — nothing to do without a fresh user gesture.
    }
  }

  const menus = {
    File: (
      <>
        <Item Icon={FilePlus} label="New document" onClick={run(onNew)} />
        <Item Icon={Copy} label="Make a copy" onClick={run(onMakeCopy)} />
        <Item Icon={Pencil} label="Rename" onClick={run(onRename)} />
        <Item Icon={Lock} label="Access" onClick={run(onAccess)} />
        <Sep />
        <Item Icon={FileDown} label="Download as PDF" onClick={run(() => onDownload("pdf"))} />
        <Item Icon={FileText} label="Download as Markdown" onClick={run(() => onDownload("markdown"))} />
        <Item Icon={FileCode} label="Download as HTML" onClick={run(() => onDownload("html"))} />
        <Item Icon={Printer} label="Print" shortcut={`${MOD}+P`} onClick={run(onPrint)} />
        <Sep />
        <Item Icon={Trash2} label="Move to trash" onClick={run(onDelete)} />
      </>
    ),
    Edit: (
      <>
        <Item Icon={Undo2} label="Undo" shortcut={`${MOD}+Z`} disabled={!editor?.can().undo()} onClick={cmd((c) => c.undo())} />
        <Item Icon={Redo2} label="Redo" shortcut={`${MOD}+Y`} disabled={!editor?.can().redo()} onClick={cmd((c) => c.redo())} />
        <Sep />
        <Item Icon={SquareDashedMousePointer} label="Select all" shortcut={`${MOD}+A`} onClick={cmd((c) => c.selectAll())} />
        <Item Icon={ClipboardPaste} label="Paste without formatting" shortcut={`${MOD}+Shift+V`} onClick={pasteWithoutFormatting} />
        <Sep />
        <Item Icon={Search} label="Find and replace" shortcut={`${MOD}+H`} onClick={run(onFindReplace)} />
      </>
    ),
    View: (
      <>
        <Item Icon={fullscreen ? Minimize2 : Maximize2} label={fullscreen ? "Exit full screen" : "Full screen"} onClick={run(onToggleFullscreen)} />
        <Sep />
        <Item Icon={LayoutGrid} label="Pageless format" active={pageless} onClick={run(onTogglePageless)} />
        <Item label="Page view — Letter" active={!pageless && pageSize === "letter"} onClick={run(() => onSetPageSize("letter"))} />
        <Item label="Page view — A4" active={!pageless && pageSize === "a4"} onClick={run(() => onSetPageSize("a4"))} />
      </>
    ),
    Insert: (
      <>
        <Item Icon={ImageIcon} label="Image" onClick={run(onInsertImage)} />
        <div className="relative" onMouseEnter={() => setTableFlyoutOpen(true)} onMouseLeave={() => setTableFlyoutOpen(false)}>
          <button
            onClick={() => setTableFlyoutOpen((o) => !o)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-ink-600 hover:bg-ink-50"
          >
            <TableIcon className="h-3.5 w-3.5 shrink-0 text-ink-400" />
            <span className="flex-1">Table</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-300" />
          </button>
          {tableFlyoutOpen && (
            <div className="absolute left-full top-0 z-40 ml-1 card shadow-panel">
              <TableGridPicker
                onInsert={(rows, cols) => {
                  cmd((c) => c.insertTable({ rows, cols, withHeaderRow: true }))();
                  setTableFlyoutOpen(false);
                }}
              />
            </div>
          )}
        </div>
        <Item Icon={Link2} label="Link" shortcut={`${MOD}+K`} onClick={run(() => editor && promptForLink(editor))} />
        <Item Icon={Minus} label="Horizontal line" onClick={cmd((c) => c.setHorizontalRule())} />
      </>
    ),
    Format: (
      <>
        <Item Icon={Bold} label="Bold" shortcut={`${MOD}+B`} active={editor?.isActive("bold")} onClick={cmd((c) => c.toggleBold())} />
        <Item Icon={Italic} label="Italic" shortcut={`${MOD}+I`} active={editor?.isActive("italic")} onClick={cmd((c) => c.toggleItalic())} />
        <Item Icon={Underline} label="Underline" shortcut={`${MOD}+U`} active={editor?.isActive("underline")} onClick={cmd((c) => c.toggleUnderline())} />
        <Item Icon={Strikethrough} label="Strikethrough" active={editor?.isActive("strike")} onClick={cmd((c) => c.toggleStrike())} />
        <Sep />
        <Item label="Normal text" active={editor && !editor.isActive("heading")} onClick={cmd((c) => c.setParagraph())} />
        <Item label="Heading 1" active={editor?.isActive("heading", { level: 1 })} onClick={cmd((c) => c.toggleHeading({ level: 1 }))} />
        <Item label="Heading 2" active={editor?.isActive("heading", { level: 2 })} onClick={cmd((c) => c.toggleHeading({ level: 2 }))} />
        <Item label="Heading 3" active={editor?.isActive("heading", { level: 3 })} onClick={cmd((c) => c.toggleHeading({ level: 3 }))} />
        <Sep />
        <Item Icon={AlignLeft} label="Align left" active={editor?.isActive({ textAlign: "left" })} onClick={cmd((c) => c.setTextAlign("left"))} />
        <Item Icon={AlignCenter} label="Align center" active={editor?.isActive({ textAlign: "center" })} onClick={cmd((c) => c.setTextAlign("center"))} />
        <Item Icon={AlignRight} label="Align right" active={editor?.isActive({ textAlign: "right" })} onClick={cmd((c) => c.setTextAlign("right"))} />
        <Item Icon={AlignJustify} label="Justify" active={editor?.isActive({ textAlign: "justify" })} onClick={cmd((c) => c.setTextAlign("justify"))} />
        <Item Icon={IndentIncrease} label="Increase indent" disabled={!editor?.can().sinkListItem("listItem")} onClick={cmd((c) => c.sinkListItem("listItem"))} />
        <Item Icon={IndentDecrease} label="Decrease indent" disabled={!editor?.can().liftListItem("listItem")} onClick={cmd((c) => c.liftListItem("listItem"))} />
        <Sep />
        <Item label="Line spacing — Single" active={editor?.isActive("textStyle", { lineHeight: "1" })} onClick={cmd((c) => c.setLineHeight("1"))} />
        <Item label="Line spacing — 1.15" active={editor?.isActive("textStyle", { lineHeight: "1.15" })} onClick={cmd((c) => c.setLineHeight("1.15"))} />
        <Item label="Line spacing — 1.5" active={editor?.isActive("textStyle", { lineHeight: "1.5" })} onClick={cmd((c) => c.setLineHeight("1.5"))} />
        <Item label="Line spacing — Double" active={editor?.isActive("textStyle", { lineHeight: "2" })} onClick={cmd((c) => c.setLineHeight("2"))} />
        <Sep />
        <Item Icon={List} label="Bullet list" active={editor?.isActive("bulletList")} onClick={cmd((c) => c.toggleBulletList())} />
        <Item Icon={ListOrdered} label="Numbered list" active={editor?.isActive("orderedList")} onClick={cmd((c) => c.toggleOrderedList())} />
        <Item Icon={ListChecks} label="Task list" active={editor?.isActive("taskList")} onClick={cmd((c) => c.toggleTaskList())} />
        <Sep />
        <Item label="1 column" active={columns === 1} onClick={run(() => onSetColumns(1))} />
        <Item Icon={Columns2} label="2 columns" active={columns === 2} onClick={run(() => onSetColumns(2))} />
        <Item Icon={Columns3} label="3 columns" active={columns === 3} onClick={run(() => onSetColumns(3))} />
        <Sep />
        <Item Icon={RemoveFormatting} label="Clear formatting" shortcut={`${MOD}+\\`} onClick={cmd((c) => c.unsetAllMarks().clearNodes())} />
      </>
    ),
    Tools: (
      <>
        <Item Icon={Hash} label="Word count" shortcut={`${MOD}+Shift+C`} onClick={run(onWordCount)} />
        <Item Icon={Info} label="Details" onClick={run(onDetails)} />
      </>
    ),
  };

  return (
    <div ref={ref} className="relative flex items-center gap-0.5 border-b border-ink-100 bg-white px-3 py-1 print:hidden">
      {Object.entries(menus).map(([label, content]) => (
        <div key={label} className="relative">
          <MenuButton label={label} isOpen={openMenu === label} onToggle={() => setOpenMenu((m) => (m === label ? null : label))} />
          {openMenu === label && (
            <div
              className={`absolute left-0 top-full z-30 mt-1 w-64 card p-1.5 shadow-panel ${
                label === "Insert" ? "overflow-visible" : "max-h-[70vh] overflow-y-auto"
              }`}
            >
              {content}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
