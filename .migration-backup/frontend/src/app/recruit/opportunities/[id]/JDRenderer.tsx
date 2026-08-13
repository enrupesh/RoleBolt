"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function JDRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed
      prose-headings:font-bold prose-headings:text-slate-900
      prose-strong:text-slate-900 prose-strong:font-semibold
      prose-ul:my-1 prose-li:my-0.5
      prose-p:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
