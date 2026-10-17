import { memo } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { humanizePriorityTerms } from "../../lib/priorities.js";

const REMARK_PLUGINS = [remarkGfm];
const COMPONENTS = {
  a({ href, title, children }) {
    if (!href) return children;
    return <a href={href} title={title} target={href.startsWith("#") ? undefined : "_blank"} rel="noopener noreferrer">{children}</a>;
  },
  pre({ children }) {
    return <pre tabIndex={0}>{children}</pre>;
  },
  table({ children }) {
    return (
      <div className="assistant-message-table" role="region" aria-label="Table in Kas's reply" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  },
  img({ alt }) {
    return alt || null;
  },
};

function AssistantMessageContent({ content }) {
  return (
    <div className="assistant-message min-w-0">
      <Markdown remarkPlugins={REMARK_PLUGINS} components={COMPONENTS} skipHtml>
        {humanizePriorityTerms(content)}
      </Markdown>
    </div>
  );
}

export default memo(AssistantMessageContent);
