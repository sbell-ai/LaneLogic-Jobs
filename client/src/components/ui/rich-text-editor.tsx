import { useState, useCallback, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  Eye,
} from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

function MenuBar({ editor }: { editor: ReturnType<typeof useEditor> }) {
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

  if (!editor) return null;

  const buttons = [
    {
      icon: <Heading2 size={16} />,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive("heading", { level: 2 }),
      label: "Heading 2",
      testId: "button-toolbar-h2",
    },
    {
      icon: <Heading3 size={16} />,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive("heading", { level: 3 }),
      label: "Heading 3",
      testId: "button-toolbar-h3",
    },
    {
      icon: <Bold size={16} />,
      action: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive("bold"),
      label: "Bold",
      testId: "button-toolbar-bold",
    },
    {
      icon: <Italic size={16} />,
      action: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive("italic"),
      label: "Italic",
      testId: "button-toolbar-italic",
    },
    {
      icon: <List size={16} />,
      action: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive("bulletList"),
      label: "Bullet List",
      testId: "button-toolbar-bullet-list",
    },
    {
      icon: <ListOrdered size={16} />,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive("orderedList"),
      label: "Numbered List",
      testId: "button-toolbar-ordered-list",
    },
    {
      icon: <LinkIcon size={16} />,
      action: setLink,
      active: editor.isActive("link"),
      label: "Link",
      testId: "button-toolbar-link",
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-slate-50 dark:bg-slate-800/50 rounded-t-lg" data-testid="toolbar-rich-text">
      {buttons.map((btn) => (
        <Button
          key={btn.label}
          type="button"
          variant="ghost"
          size="sm"
          onClick={btn.action}
          className={`h-8 w-8 p-0 ${btn.active ? "bg-primary/10 text-primary" : ""}`}
          title={btn.label}
          data-testid={btn.testId}
        >
          {btn.icon}
        </Button>
      ))}
    </div>
  );
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-primary underline" },
      }),
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

  return (
    <div className="border border-border rounded-lg overflow-hidden" data-testid="rich-text-editor">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border-b border-border">
        {!isHtmlMode && <MenuBar editor={editor} />}
        {isHtmlMode && <div className="p-2" />}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={toggleMode}
          className="m-1 gap-1.5 text-xs"
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
            prose-p:text-base prose-p:leading-relaxed prose-p:mb-2
            prose-a:text-primary prose-a:underline
            prose-ul:list-disc prose-ul:pl-6 prose-ul:mb-2
            prose-ol:list-decimal prose-ol:pl-6 prose-ol:mb-2
            prose-li:mb-0.5
            prose-strong:font-bold
            [&_.tiptap]:outline-none [&_.tiptap]:min-h-[260px]"
          data-testid="editor-visual-content"
        />
      )}
    </div>
  );
}
