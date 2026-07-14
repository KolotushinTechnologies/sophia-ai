import type { ReactNode } from 'react';

/** Markdown → React: bold/lists/headers/links + price tables as stylish plates. */
export function MarkdownContent({ text }: { text: string }) {
  if (!text) return null;
  const blocks = splitBlocks(normalizeMarkdown(text));
  return (
    <div className="md">
      {blocks.map((block, i) => {
        if (block.type === 'ul') {
          const priceCards = tryPriceCards(block.items);
          if (priceCards) {
            return (
              <div key={i} className="price-plates">
                {priceCards.map((card, j) => (
                  <div key={j} className="price-plate">
                    <div className="price-plate-name">{renderInline(card.name)}</div>
                    <div className="price-plate-value">{renderInline(card.value)}</div>
                    {card.hint ? <div className="price-plate-hint">{renderInline(card.hint)}</div> : null}
                  </div>
                ))}
              </div>
            );
          }
          return (
            <ul key={i} className="md-ul">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === 'ol') {
          return (
            <ol key={i} className="md-ol">
              {block.items.map((item, j) => (
                <li key={j}>{renderInline(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === 'table') {
          return <TablePlates key={i} headers={block.headers} rows={block.rows} />;
        }
        if (block.type === 'h1' || block.type === 'h2' || block.type === 'h3') {
          const Tag = block.type;
          return (
            <Tag key={i} className={`md-${block.type}`}>
              {renderInline(block.text)}
            </Tag>
          );
        }
        if (block.type === 'p') {
          return (
            <p key={i} className="md-p">
              {renderInline(block.text)}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
}

function TablePlates({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const nameIdx = 0;
  const restHeaders = headers.slice(1);
  return (
    <div className="price-plates">
      {rows.map((row, i) => (
        <div key={i} className="price-plate">
          <div className="price-plate-name">{renderInline(row[nameIdx] ?? '')}</div>
          <div className="price-plate-meta">
            {restHeaders.map((h, j) => (
              <div key={j} className="price-plate-row">
                <span className="price-plate-label">{stripMd(h)}</span>
                <span className="price-plate-value">{renderInline(row[j + 1] ?? '—')}</span>
              </div>
            ))}
            {restHeaders.length === 0 && row[1] ? (
              <div className="price-plate-value">{renderInline(row[1])}</div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function tryPriceCards(items: string[]): Array<{ name: string; value: string; hint?: string }> | null {
  const cards = items.map((raw) => {
    const cleaned = stripMd(raw);
    // **Name** — 900₽   or Name — будни 8900 / выходные 11500
    const m =
      /^\*{0,2}(.+?)\*{0,2}\s*[—–\-:]\s*(.+)$/u.exec(cleaned) ||
      /^(.+?)\s{2,}(.+)$/u.exec(cleaned);
    if (!m) return null;
    const name = m[1]!.trim();
    const value = m[2]!.trim();
    // URLs / @handles are contacts, not prices (digits in paths break detection)
    if (/https?:\/\//i.test(value) || /^@[\w.]+/.test(value) || /t\.me\//i.test(value)) return null;
    if (!/\d/.test(value) && !/₽|руб|бесплат/i.test(value)) return null;
    return { name, value };
  });
  if (cards.every(Boolean) && cards.length >= 2) {
    return cards as Array<{ name: string; value: string }>;
  }
  return null;
}

function normalizeMarkdown(src: string): string {
  return src
    .replace(/\r\n/g, '\n')
    .replace(/^#{4,}\s*/gm, '### ')
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/^\s*\*\*\*+\s*$/gm, '');
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/__/g, '').replace(/`/g, '').trim();
}

type Block =
  | { type: 'p' | 'h1' | 'h2' | 'h3'; text: string }
  | { type: 'ul' | 'ol'; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

function isTableSep(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.includes('|') && !isTableSep(t);
}

function parseTableRow(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((c) => c.trim());
}

function splitBlocks(src: string): Block[] {
  const lines = src.split('\n');
  const out: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i += 1;
      continue;
    }

    // markdown table
    if (isTableRow(line) && i + 1 < lines.length && isTableSep(lines[i + 1] ?? '')) {
      const headers = parseTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i] ?? '')) {
        rows.push(parseTableRow(lines[i]!));
        i += 1;
      }
      out.push({ type: 'table', headers, rows });
      continue;
    }

    // loose table without separator (pipes on consecutive lines)
    if (isTableRow(line) && i + 1 < lines.length && isTableRow(lines[i + 1] ?? '')) {
      const rows: string[][] = [];
      while (i < lines.length && (isTableRow(lines[i] ?? '') || isTableSep(lines[i] ?? ''))) {
        if (isTableRow(lines[i]!)) rows.push(parseTableRow(lines[i]!));
        i += 1;
      }
      if (rows.length >= 2) {
        out.push({ type: 'table', headers: rows[0]!, rows: rows.slice(1) });
        continue;
      }
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line.trim());
    if (heading) {
      const level = heading[1]!.length;
      out.push({
        type: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3',
        text: heading[2]!,
      });
      i += 1;
      continue;
    }

    if (/^[-*•]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^[-*•]\s+/, ''));
        i += 1;
      }
      out.push({ type: 'ul', items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.)]\s+/.test((lines[i] ?? '').trim())) {
        items.push((lines[i] ?? '').trim().replace(/^\d+[.)]\s+/, ''));
        i += 1;
      }
      out.push({ type: 'ol', items });
      continue;
    }

    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i] ?? '';
      if (!next.trim()) break;
      if (/^(#{1,3})\s+/.test(next.trim())) break;
      if (/^[-*•]\s+/.test(next.trim())) break;
      if (/^\d+[.)]\s+/.test(next.trim())) break;
      if (isTableRow(next) || isTableSep(next)) break;
      para.push(next);
      i += 1;
    }
    out.push({ type: 'p', text: para.join('\n') });
  }

  return out;
}

function toTelHref(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.startsWith('8') && digits.length === 11) return `tel:+7${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 11) return `tel:+${digits}`;
  return `tel:${digits}`;
}

function trimUrlTrail(url: string): { href: string; trail: string } {
  let href = url;
  let trail = '';
  while (/[.,);:!?]/.test(href.at(-1) ?? '')) {
    trail = href.slice(-1) + trail;
    href = href.slice(0, -1);
  }
  return { href, trail };
}

/** Plain URLs, phones, @handles → clickable anchors. */
function linkifyPlain(text: string, keyStart = 0): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /(https?:\/\/[^\s<]+)|(@[A-Za-z0-9._]{2,})|(\+?\d[\d\s().-]{8,}\d)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = keyStart;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    if (match[1]) {
      const { href, trail } = trimUrlTrail(match[1]);
      nodes.push(
        <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="md-a">
          {href}
        </a>,
      );
      if (trail) nodes.push(trail);
    } else if (match[2]) {
      const handle = match[2];
      nodes.push(
        <a
          key={key++}
          href={`https://instagram.com/${handle.slice(1)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="md-a"
        >
          {handle}
        </a>,
      );
    } else {
      const phone = match[3]!;
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) {
        nodes.push(phone);
      } else {
        nodes.push(
          <a key={key++} href={toTelHref(phone)} className="md-a md-tel">
            {phone}
          </a>,
        );
      }
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // IMPORTANT: do not treat underscores inside URLs/handles (sofi_park_…) as italic
  const re =
    /(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\n]+\*)|(?<![\w./])_([^_\n]+?)_(?![\w/])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      nodes.push(...linkifyPlain(text.slice(last, match.index), key));
      key += 50;
    }
    const full = match[0];
    if (match[1]) {
      const href = match[3]!;
      const isTel = href.startsWith('tel:');
      nodes.push(
        <a
          key={key++}
          href={href}
          {...(isTel ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
          className={`md-a${isTel ? ' md-tel' : ''}`}
        >
          {match[2]}
        </a>,
      );
    } else if (full.startsWith('`')) {
      nodes.push(
        <code key={key++} className="md-code">
          {full.slice(1, -1)}
        </code>,
      );
    } else if (full.startsWith('**') || full.startsWith('__')) {
      nodes.push(<strong key={key++}>{linkifyPlain(full.slice(2, -2), key)}</strong>);
      key += 50;
    } else if (match[8] !== undefined) {
      // underscore italic (group 8 = inner text)
      nodes.push(<em key={key++}>{linkifyPlain(match[8], key)}</em>);
      key += 50;
    } else {
      nodes.push(<em key={key++}>{linkifyPlain(full.slice(1, -1), key)}</em>);
      key += 50;
    }
    last = match.index + full.length;
  }
  if (last < text.length) nodes.push(...linkifyPlain(text.slice(last), key));
  return nodes;
}
