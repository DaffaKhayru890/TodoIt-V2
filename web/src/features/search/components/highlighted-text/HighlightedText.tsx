import { splitHighlight } from '../../utils/highlight-search';

export function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = splitHighlight(text, query);

  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark className="search-highlight" key={`${part.text}-${index}`}>
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </>
  );
}
