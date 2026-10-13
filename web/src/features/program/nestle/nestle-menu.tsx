"use client";

import { useEffect, useId, useRef, useState } from "react";

import s from "./nestle.module.css";

type MenuItem = { id: string; label: string };

/**
 * The page's own way round, kept on the screen: a button at the foot of the window that opens the list
 * of sections, with the one being read marked. Each entry is a link to its section, so it also works
 * before the script has loaded.
 */
function NestleMenu({
  items,
  label,
  topLabel,
}: {
  items: MenuItem[];
  label: string;
  topLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useId();

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => element !== null);
    if (sections.length === 0) {
      return;
    }
    // A section counts as read while it crosses the band around the middle of the window.
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) {
          setCurrent(visible.target.id);
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setOpen(false);
          root.current?.querySelector("button")?.focus();
        }
      } else if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  return (
    <div ref={root} className={s.menu}>
      {open && (
        <nav id={panel} aria-label={label} className={s.menuPanel}>
          {items.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={current === item.id ? "true" : undefined}
              className={s.menuLink}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <a href="#top" className={s.menuTop} onClick={() => setOpen(false)}>
            {topLabel} <span aria-hidden="true">↑</span>
          </a>
        </nav>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panel : undefined}
        className={s.menuButton}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span aria-hidden="true">{open ? "▾" : "▴"}</span>
      </button>
    </div>
  );
}

export { NestleMenu };
