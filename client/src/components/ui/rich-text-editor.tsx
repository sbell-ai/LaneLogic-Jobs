import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Image from "@tiptap/extension-image";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import CharacterCount from "@tiptap/extension-character-count";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Link as LinkIcon,
  Code,
  Eye,
  Briefcase,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Minus,
  Quote,
  Table as TableIcon,
  Image as ImageIcon,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function JobFeedNodeView({ node, deleteNode }: NodeViewProps) {
  const category = node.attrs.category || "all";
  return (
    <NodeViewWrapper className="not-prose my-4" contentEditable={false}>
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 select-none"
        data-testid={`block-job-feed-${category}`}
      >
        <Briefcase size={16} className="text-primary shrink-0" />
        <span className="text-sm font-semibold text-primary">
          Job Feed: {category}
        </span>
        <button
          type="button"
          onClick={deleteNode}
          className="ml-auto p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-destructive transition-colors"
          data-testid={`button-delete-job-feed-${category}`}
        >
          <X size={14} />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

const JobFeedBlock = Node.create({
  name: "jobFeedBlock",
  group: "block",
  atom: true,
  addAttributes() {
    return { category: { default: "all" } };
  },
  parseHTML() {
    return [{
      tag: 'div[data-job-feed]',
      getAttrs: (el) => {
        const element = el as HTMLElement;
        return { category: element.getAttribute("data-job-feed") || "all" };
      },
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes({ "data-job-feed": HTMLAttributes.category })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(JobFeedNodeView);
  },
});

const COLORS = [
  "#000000", "#374151", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#ffffff",
];

const HIGHLIGHT_COLORS = [
  "#fef08a", "#bbf7d0", "#bfdbfe", "#fde8d8", "#fce7f3", "#e9d5ff",
];

function ToolbarSep() {
  return <div className="w-px h-5 bg-border mx-0.5 shrink-0" />;
}

function ToolbarBtn({
  onClick, active, title, testId, children, disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  testId?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`h-7 w-7 p-0 shrink-0 ${active ? "bg-primary/10 text-primary" : ""}`}
      title={title}
      data-testid={testId}
    >
      {children}
    </Button>
  );
}

function MenuBar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  const insertJobFeed = useCallback(() => {
    if (!editor) return;
    const category = window.prompt(
      "Enter job category (e.g. tanker, cdl, flatbed, dispatcher, local, owner_operator):"
    );
    if (!category) return;
    editor.chain().focus().insertContent({ type: "jobFeedBlock", attrs: { category: category.trim().toLowerCase() } }).run();
  }, [editor]);

  const insertImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Image URL:");
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  if (!editor) return null;

  const inTable = editor.isActive("table");

  return (
    <div className="flex flex-wrap gap-0.5 p-2 border-b border-border bg-slate-50 dark:bg-slate-800/50" data-testid="toolbar-rich-text">
      {/* Headings */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2" testId="button-toolbar-h2"><Heading2 size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3" testId="button-toolbar-h3"><Heading3 size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Heading 4" testId="button-toolbar-h4"><Heading4 size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Inline marks */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold" testId="button-toolbar-bold"><Bold size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic" testId="button-toolbar-italic"><Italic size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline" testId="button-toolbar-underline"><UnderlineIcon size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough" testId="button-toolbar-strike"><Strikethrough size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive("subscript")} title="Subscript" testId="button-toolbar-subscript"><SubscriptIcon size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive("superscript")} title="Superscript" testId="button-toolbar-superscript"><SuperscriptIcon size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Color */}
      <div className="relative">
        <button
          type="button"
          title="Text Color"
          data-testid="button-toolbar-color"
          onClick={() => { setShowColorPicker(v => !v); setShowHighlightPicker(false); setShowTableMenu(false); }}
          className="h-7 w-7 p-0.5 rounded hover:bg-accent flex items-center justify-center shrink-0"
        >
          <span className="text-xs font-bold leading-none" style={{ color: editor.getAttributes("textStyle").color || "currentColor" }}>A</span>
          <span className="w-full h-1 rounded-sm mt-0.5 absolute bottom-1" style={{ background: editor.getAttributes("textStyle").color || "#000", width: "14px" }} />
        </button>
        {showColorPicker && (
          <div className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-xl p-2 flex flex-wrap gap-1 w-32">
            {COLORS.map(c => (
              <button key={c} type="button" title={c} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ background: c }}
              />
            ))}
            <button type="button" title="Remove color" onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-1">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Highlight */}
      <div className="relative">
        <button
          type="button"
          title="Highlight"
          data-testid="button-toolbar-highlight"
          onClick={() => { setShowHighlightPicker(v => !v); setShowColorPicker(false); setShowTableMenu(false); }}
          className="h-7 w-7 p-0.5 rounded hover:bg-accent flex items-center justify-center shrink-0"
        >
          <Highlighter size={15} />
        </button>
        {showHighlightPicker && (
          <div className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-xl p-2 flex flex-wrap gap-1 w-36">
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c} type="button" title={c} onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlightPicker(false); }}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ background: c }}
              />
            ))}
            <button type="button" title="Remove highlight" onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-1">
              Reset
            </button>
          </div>
        )}
      </div>

      <ToolbarSep />

      {/* Alignment */}
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align Left" testId="button-toolbar-align-left"><AlignLeft size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align Center" testId="button-toolbar-align-center"><AlignCenter size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align Right" testId="button-toolbar-align-right"><AlignRight size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("justify").run()} active={editor.isActive({ textAlign: "justify" })} title="Justify" testId="button-toolbar-align-justify"><AlignJustify size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Lists */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet List" testId="button-toolbar-bullet-list"><List size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered List" testId="button-toolbar-ordered-list"><ListOrdered size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive("taskList")} title="Task List" testId="button-toolbar-task-list"><CheckSquare size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Block elements */}
      <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote" testId="button-toolbar-blockquote"><Quote size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Horizontal Rule" testId="button-toolbar-hr"><Minus size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Link & Image */}
      <ToolbarBtn onClick={setLink} active={editor.isActive("link")} title="Link" testId="button-toolbar-link"><LinkIcon size={15} /></ToolbarBtn>
      <ToolbarBtn onClick={insertImage} active={false} title="Insert Image URL" testId="button-toolbar-image"><ImageIcon size={15} /></ToolbarBtn>

      <ToolbarSep />

      {/* Table */}
      <div className="relative">
        <button
          type="button"
          title="Table"
          data-testid="button-toolbar-table"
          onClick={() => { setShowTableMenu(v => !v); setShowColorPicker(false); setShowHighlightPicker(false); }}
          className={`h-7 w-7 p-0.5 rounded hover:bg-accent flex items-center justify-center shrink-0 ${inTable ? "bg-primary/10 text-primary" : ""}`}
        >
          <TableIcon size={15} />
        </button>
        {showTableMenu && (
          <div className="absolute top-8 left-0 z-50 bg-white dark:bg-slate-900 border border-border rounded-lg shadow-xl p-1 w-44 text-sm">
            {!inTable ? (
              <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setShowTableMenu(false); }}>
                Insert Table (3×3)
              </button>
            ) : (
              <>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().addRowBefore().run(); setShowTableMenu(false); }}>Add Row Above</button>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().addRowAfter().run(); setShowTableMenu(false); }}>Add Row Below</button>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().deleteRow().run(); setShowTableMenu(false); }}>Delete Row</button>
                <div className="border-t border-border my-1" />
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().addColumnBefore().run(); setShowTableMenu(false); }}>Add Column Left</button>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().addColumnAfter().run(); setShowTableMenu(false); }}>Add Column Right</button>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().deleteColumn().run(); setShowTableMenu(false); }}>Delete Column</button>
                <div className="border-t border-border my-1" />
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().toggleHeaderRow().run(); setShowTableMenu(false); }}>Toggle Header Row</button>
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent" onClick={() => { editor.chain().focus().mergeOrSplit().run(); setShowTableMenu(false); }}>Merge / Split Cells</button>
                <div className="border-t border-border my-1" />
                <button type="button" className="w-full text-left px-3 py-1.5 rounded hover:bg-accent text-destructive" onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }}>Delete Table</button>
              </>
            )}
          </div>
        )}
      </div>

      <ToolbarSep />

      {/* Job Feed */}
      <ToolbarBtn onClick={insertJobFeed} active={false} title="Insert Job Feed Block" testId="button-toolbar-job-feed"><Briefcase size={15} /></ToolbarBtn>
    </div>
  );
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      Image.configure({ HTMLAttributes: { class: "max-w-full rounded-lg my-2" } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      CharacterCount,
      JobFeedBlock,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && !isHtmlMode && !editor.isFocused) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== value) {
        editor.commands.setContent(value, false);
      }
    }
  }, [editor, value, isHtmlMode]);

  const toggleMode = useCallback(() => {
    if (isHtmlMode && editor) {
      editor.commands.setContent(value);
    }
    setIsHtmlMode(!isHtmlMode);
  }, [isHtmlMode, editor, value]);

  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;
  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="rich-text-editor">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border-b border-border">
        {!isHtmlMode && <MenuBar editor={editor} />}
        {isHtmlMode && <div className="p-2 text-xs text-muted-foreground">HTML source mode</div>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          className="m-1 gap-1.5 text-xs shrink-0"
          data-testid="button-toggle-html-mode"
        >
          {isHtmlMode ? <Eye size={14} /> : <Code size={14} />}
          {isHtmlMode ? "Visual" : "HTML"}
        </Button>
      </div>

      {isHtmlMode ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[300px] font-mono text-sm resize-y border-0 rounded-none focus-visible:ring-0"
          data-testid="textarea-html-content"
        />
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-slate dark:prose-invert max-w-none min-h-[300px] p-4
            prose-headings:font-display prose-headings:font-bold
            prose-h2:text-2xl prose-h2:mt-4 prose-h2:mb-2
            prose-h3:text-xl prose-h3:mt-3 prose-h3:mb-2
            prose-h4:text-lg prose-h4:mt-3 prose-h4:mb-1
            prose-p:text-base prose-p:leading-relaxed prose-p:mb-2
            prose-a:text-primary prose-a:underline
            prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-2
            prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-2
            prose-li:mb-0.5
            prose-strong:font-bold
            prose-blockquote:border-l-4 prose-blockquote:border-primary/40 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-muted-foreground
            prose-table:w-full prose-table:border-collapse
            prose-th:border prose-th:border-border prose-th:p-2 prose-th:bg-slate-50 prose-th:font-semibold
            prose-td:border prose-td:border-border prose-td:p-2
            [&_.tiptap]:outline-none [&_.tiptap]:min-h-[260px]
            [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0
            [&_ul[data-type=taskList]_li]:flex [&_ul[data-type=taskList]_li]:items-start [&_ul[data-type=taskList]_li]:gap-2
            [&_ul[data-type=taskList]_li_>label]:flex [&_ul[data-type=taskList]_li_>label]:items-center [&_ul[data-type=taskList]_li_>label]:mt-0.5"
          data-testid="editor-visual-content"
        />
      )}

      {!isHtmlMode && editor && (
        <div className="flex gap-4 px-4 py-1.5 border-t border-border bg-slate-50/50 dark:bg-slate-800/30 text-xs text-muted-foreground">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
      )}
    </div>
  );
}
