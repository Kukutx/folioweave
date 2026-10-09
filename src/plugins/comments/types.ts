export type CommentSort = "latest" | "oldest" | "hottest";
export type CommentEntry = {
  id: string;
  author: string;
  website?: string;
  body: string;
  createdAt: number;
  likes: number;
  authorRole: "author" | "reader";
  status: "approved" | "waiting";
  pinned: boolean;
  replyTo?: string;
  children: CommentEntry[];
};
export type CommentPage = {
  items: CommentEntry[];
  total: number;
  page: number;
  pages: number;
};
export type CommentDraft = { name: string; email: string; body: string };
export type CommentSession = { token: string; name: string };
export type ReplyTarget = { id: string; rootId: string; author: string };
export type CommentService = {
  list: (options: {
    articleId: string;
    page: number;
    pageSize: number;
    sort: CommentSort;
    signal: AbortSignal;
    token?: string;
  }) => Promise<CommentPage>;
  submit: (options: {
    articleId: string;
    draft: CommentDraft;
    reply: ReplyTarget | null;
    token?: string;
    signal: AbortSignal;
  }) => Promise<CommentEntry>;
  like: (id: string, liked: boolean, signal: AbortSignal) => Promise<void>;
  authenticate: (token: string, signal: AbortSignal) => Promise<CommentSession>;
};
