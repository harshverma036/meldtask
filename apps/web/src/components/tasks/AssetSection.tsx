import { useState, useRef } from "react";
import { format } from "date-fns";
import {
  Paperclip,
  Link as LinkIcon,
  Trash2,
  Download,
  ExternalLink,
  Upload,
  Plus,
  File,
  FileImage,
  FileText,
} from "lucide-react";
import {
  useTaskAssets,
  useUploadAsset,
  useCreateAssetLink,
  useDeleteAsset,
} from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AssetSectionProps {
  projectId: string;
  taskId: string;
}

/**
 * Asset section showing uploaded files and link attachments.
 * Supports file upload (drag or click) and link attachment.
 */
export function AssetSection({ projectId, taskId }: AssetSectionProps) {
  const { data: assets = [], isLoading } = useTaskAssets(projectId, taskId);
  const uploadAsset = useUploadAsset(projectId, taskId);
  const createLink = useCreateAssetLink(projectId, taskId);
  const deleteAsset = useDeleteAsset(projectId, taskId);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAsset.mutate(file);
    }
    // Reset so the same file can be re-uploaded
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkUrl.trim() || !linkName.trim()) return;
    createLink.mutate(
      { url: linkUrl.trim(), name: linkName.trim() },
      {
        onSuccess: () => {
          setLinkUrl("");
          setLinkName("");
          setShowLinkInput(false);
        },
      }
    );
  };

  /** Return an icon component based on MIME type */
  const getFileIcon = (mimeType?: string | null) => {
    if (!mimeType) return File;
    if (mimeType.startsWith("image/")) return FileImage;
    if (mimeType.startsWith("text/")) return FileText;
    return File;
  };

  /** Format file size for display */
  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const files = assets.filter((a) => a.type === "file");
  const links = assets.filter((a) => a.type === "link");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Assets ({assets.length})
        </h4>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAsset.isPending}
          >
            <Upload className="h-3 w-3" />
            Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setShowLinkInput(!showLinkInput)}
          >
            <LinkIcon className="h-3 w-3" />
            Add Link
          </Button>
        </div>
      </div>

      {/* Link input form */}
      {showLinkInput && (
        <form
          onSubmit={handleAddLink}
          className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row"
        >
          <Input
            placeholder="Display name"
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            className="flex-1"
          />
          <Input
            placeholder="https://..."
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!linkUrl.trim() || !linkName.trim() || createLink.isPending}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      )}

      {/* Asset list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : assets.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No files or links attached yet.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Link assets */}
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between rounded-md border border-border p-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <LinkIcon className="h-4 w-4 shrink-0 text-blue-400" />
                <div className="min-w-0">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-foreground hover:underline flex items-center gap-1"
                  >
                    {link.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <button
                onClick={() => deleteAsset.mutate(link.id)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {/* File assets */}
          {files.map((file) => {
            const FileIcon = getFileIcon(file.mimeType);
            return (
              <div
                key={file.id}
                className="flex items-center justify-between rounded-md border border-border p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-foreground hover:underline flex items-center gap-1"
                      download={file.name}
                    >
                      {file.name}
                      <Download className="h-3 w-3" />
                    </a>
                    {file.size && (
                      <p className="text-[10px] text-muted-foreground">
                        {formatSize(file.size)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteAsset.mutate(file.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
