import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Trash2, Send } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useTaskComments,
  useCreateComment,
  useDeleteComment,
} from "@/hooks/useTasks";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface CommentSectionProps {
  projectId: string;
  taskId: string;
}

/**
 * Comment section showing existing comments and an input for adding new ones.
 * Parses @userId:name mentions in comment content for highlighting.
 */
export function CommentSection({ projectId, taskId }: CommentSectionProps) {
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useTaskComments(projectId, taskId);
  const createComment = useCreateComment(projectId, taskId);
  const deleteComment = useDeleteComment(projectId, taskId);
  const [content, setContent] = useState("");

  /** Render comment content with highlighted @mention markers */
  const renderContent = (text: string) => {
    // Match @userId:name patterns (mentions)
    const parts = text.split(/(@[\w-]+:[^\s]+)/g);
    return parts.map((part, i) => {
      const match = part.match(/^@([\w-]+):([^\s]+)$/);
      if (match) {
        return (
          <span
            key={i}
            className="inline-flex items-center rounded bg-primary/10 px-1 py-0.5 text-xs font-medium text-primary"
          >
            @{match[2]}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    createComment.mutate(content.trim(), {
      onSuccess: () => setContent(""),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">
        Comments ({comments.length})
      </h4>

      {/* Comment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to comment.
        </p>
      ) : (
        <div className="max-h-64 space-y-3 overflow-y-auto">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 rounded-md border border-border p-3"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage
                  src={comment.author.avatarUrl || undefined}
                  alt={comment.author.name || comment.author.email}
                />
                <AvatarFallback className="text-[10px]">
                  {(comment.author.name || comment.author.email)
                    .charAt(0)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {comment.author.name || comment.author.email}
                    {comment.author.id === user?.id && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words">
                  {renderContent(comment.content)}
                </p>
              </div>
              {/* Delete (author, project owner, or admin) */}
              {comment.author.id === user?.id && (
                <button
                  onClick={() => deleteComment.mutate(comment.id)}
                  className="shrink-0 self-start rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  aria-label="Delete comment"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          placeholder="Write a comment... (Ctrl+Enter to send). Use @name to mention."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[60px] flex-1 resize-none text-sm"
          disabled={createComment.isPending}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || createComment.isPending}
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
