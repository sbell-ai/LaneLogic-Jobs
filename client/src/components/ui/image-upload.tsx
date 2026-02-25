import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  previewHeight?: string;
  "data-testid"?: string;
}

export function ImageUpload({
  value,
  onChange,
  placeholder = "Enter image URL or upload a file",
  label,
  className = "",
  previewHeight = "h-32",
  "data-testid": testId,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      const data = await res.json();
      onChange(data.url);
      toast({ title: "Image uploaded" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={className}>
      {label && <p className="text-sm font-semibold mb-1">{label}</p>}
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          data-testid={testId ? `${testId}-input` : undefined}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          data-testid={testId ? `${testId}-upload` : undefined}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
        </Button>
        {value && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange("")}
            data-testid={testId ? `${testId}-clear` : undefined}
          >
            <X size={16} />
          </Button>
        )}
      </div>
      {value && (
        <div className="mt-3 rounded-xl border border-border overflow-hidden">
          <img src={value} alt="Preview" className={`w-full ${previewHeight} object-cover`} />
        </div>
      )}
    </div>
  );
}
