'use client';

import { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '— Pilih —',
  disabled = false,
  style,
  className,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', ...style }}
      className={className}
    >
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(p => !p)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '0.5625rem 0.875rem',
          fontSize: '0.9375rem',
          fontFamily: 'inherit',
          fontWeight: 400,
          backgroundColor: disabled ? 'var(--color-surface-raised)' : 'var(--color-surface)',
          color: selected ? 'var(--color-text)' : 'var(--color-text-subtle)',
          border: `1.5px solid ${open ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-lg)',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: open ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'none',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        {/* Chevron */}
        <svg
          width="12" height="8" viewBox="0 0 12 8" fill="none"
          style={{
            flexShrink: 0,
            transition: 'transform 0.15s ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <path d="M1 1.5L6 6.5L11 1.5" stroke="var(--color-secondary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <ul
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: 'var(--color-surface)',
            border: '1.5px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            padding: '0.25rem',
            margin: 0,
            listStyle: 'none',
            maxHeight: 240,
            overflowY: 'auto',
          }}
        >
          {options.map(opt => {
            const isActive = opt.value === value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isActive}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.9375rem',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
                  backgroundColor: isActive ? 'var(--color-primary-subtle)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'background 0.1s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLLIElement).style.backgroundColor = 'var(--color-surface-raised)';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLLIElement).style.backgroundColor = 'transparent';
                }}
              >
                {opt.value === '' ? (
                  <span style={{ color: 'var(--color-text-subtle)' }}>{opt.label}</span>
                ) : opt.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
