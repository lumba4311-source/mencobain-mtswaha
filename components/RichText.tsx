'use client';

import { useRef, useCallback } from 'react';

// ── Parser markup → HTML ──────────────────────────────────────────────────────
// Format yang didukung:
//   **teks**   → <strong>teks</strong>
//   *teks*     → <em>teks</em>
//   __teks__   → <u>teks</u>
// Aman — tidak menggunakan eval, hanya replace tag yang diizinkan.

export function parseRichText(text: string): string {
  if (!text) return '';
  // Escape HTML dulu untuk keamanan
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Lalu terapkan format (urutan penting: ** sebelum *)
  escaped = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<u>$1</u>');

  // Preserve newlines
  escaped = escaped.replace(/\n/g, '<br/>');

  return escaped;
}

// ── Komponen renderer ─────────────────────────────────────────────────────────
interface RichTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  as?: 'p' | 'span' | 'div';
}

export function RichText({ text, className, style, as: Tag = 'span' }: RichTextProps) {
  return (
    <Tag
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: parseRichText(text) }}
    />
  );
}

// ── Toolbar B/I/U ─────────────────────────────────────────────────────────────
type FormatType = 'bold' | 'italic' | 'underline';

const FORMAT_MAP: Record<FormatType, { prefix: string; suffix: string; label: string; title: string; style: React.CSSProperties }> = {
  bold:      { prefix: '**', suffix: '**', label: 'B',  title: 'Bold (**teks**)',      style: { fontWeight: 700 } },
  italic:    { prefix: '*',  suffix: '*',  label: 'I',  title: 'Italic (*teks*)',       style: { fontStyle: 'italic' } },
  underline: { prefix: '__', suffix: '__', label: 'U',  title: 'Underline (__teks__)',  style: { textDecoration: 'underline' } },
};

interface FormatToolbarProps {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  value: string;
  onChange: (val: string) => void;
}

export function FormatToolbar({ targetRef, value, onChange }: FormatToolbarProps) {
  function applyFormat(type: FormatType) {
    const el = targetRef.current;
    if (!el) return;

    const start = el.selectionStart ?? 0;
    const end   = el.selectionEnd   ?? 0;
    const { prefix, suffix } = FORMAT_MAP[type];

    let newVal: string;
    let newStart: number;
    let newEnd: number;

    if (start === end) {
      // Tidak ada seleksi — insert placeholder
      const placeholder = FORMAT_MAP[type].label === 'B' ? 'teks bold'
                        : FORMAT_MAP[type].label === 'I' ? 'teks italic'
                        : 'teks underline';
      newVal   = value.slice(0, start) + prefix + placeholder + suffix + value.slice(end);
      newStart = start + prefix.length;
      newEnd   = newStart + placeholder.length;
    } else {
      const selected = value.slice(start, end);
      newVal   = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
      newStart = start + prefix.length;
      newEnd   = end   + prefix.length;
    }

    onChange(newVal);

    // Kembalikan fokus dan seleksi setelah React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(newStart, newEnd);
    });
  }

  return (
    <div style={{ display: 'flex', gap: 3, marginBottom: 4 }}>
      {(Object.entries(FORMAT_MAP) as [FormatType, typeof FORMAT_MAP[FormatType]][]).map(([type, cfg]) => (
        <button
          key={type}
          type="button"
          title={cfg.title}
          onMouseDown={e => {
            e.preventDefault(); // jangan blur textarea
            applyFormat(type);
          }}
          style={{
            width: 26, height: 26,
            border: '1px solid var(--color-border)',
            borderRadius: 4,
            background: 'var(--color-surface-raised)',
            color: 'var(--color-text)',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            ...cfg.style,
          }}
        >
          {cfg.label}
        </button>
      ))}
    </div>
  );
}

// ── RichTextInput: textarea + toolbar ────────────────────────────────────────
interface RichTextInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  style?: React.CSSProperties;
  className?: string;
  inputStyle?: React.CSSProperties;
}

export function RichTextInput({
  value, onChange, placeholder, rows = 3, style, className, inputStyle,
}: RichTextInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div style={style} className={className}>
      <FormatToolbar targetRef={ref} value={value} onChange={onChange} />
      <textarea
        ref={ref}
        className="form-input"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', ...inputStyle }}
      />
    </div>
  );
}

// ── RichTextInputLine: input single-line + toolbar ────────────────────────────
interface RichTextInputLineProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function RichTextInputLine({
  value, onChange, placeholder, style, className,
}: RichTextInputLineProps) {
  const ref = useRef<HTMLInputElement>(null);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  return (
    <div style={{ flex: 1, ...style }} className={className}>
      <FormatToolbar targetRef={ref as React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>} value={value} onChange={onChange} />
      <input
        ref={ref}
        className="form-input"
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
    </div>
  );
}
