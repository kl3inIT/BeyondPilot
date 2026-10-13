"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import s from "./nestle.module.css";

type Area = {
  id: string;
  title: string;
  icon: string;
  today?: string;
  good?: string;
  intro?: string;
  bring?: string[];
  body?: string;
};

type Labels = { tabs: string; today: string; good: string; bring: string };

/**
 * The challenge areas as a list of tabs beside the panel of the one chosen: how the work is done
 * today, what good looks like and what to bring. Arrow keys move between the tabs.
 */
function NestleAreas({ areas, labels }: { areas: Area[]; labels: Labels }) {
  const [selected, setSelected] = useState(areas[0]?.id);
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const area = areas.find((item) => item.id === selected) ?? areas[0];

  function move(to: number) {
    const next = areas[(to + areas.length) % areas.length];
    setSelected(next.id);
    tabs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: areas.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      move(keys[event.key]);
    }
  }

  return (
    <div className={s.areas}>
      <div className={s.areasGrid}>
        <div role="tablist" aria-label={labels.tabs} aria-orientation="vertical" className={s.tabs}>
          {areas.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                tabs.current[item.id] = element;
              }}
              type="button"
              role="tab"
              id={`area-tab-${item.id}`}
              aria-selected={item.id === area.id}
              aria-controls="area-panel"
              tabIndex={item.id === area.id ? 0 : -1}
              className={s.tab}
              onClick={() => setSelected(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <Image src={item.icon} alt="" width={34} height={34} className={s.tabIcon} />
              {item.title}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id="area-panel"
          aria-labelledby={`area-tab-${area.id}`}
          className={s.panel}
        >
          <div className={s.panelHead}>
            <Image src={area.icon} alt="" width={60} height={60} className={s.panelIcon} />
            <h3 className={s.panelTitle}>{area.title}</h3>
          </div>
          {area.body ? (
            <p className={s.panelText}>{area.body}</p>
          ) : (
            <>
              <p className={s.label}>{labels.today}</p>
              <p className={s.panelText}>{area.today}</p>
              <p className={s.panelLabel}>{labels.good}</p>
              <p className={s.panelText}>{area.good}</p>
              <p className={s.panelLabel}>{labels.bring}</p>
              {area.intro && <p className={s.panelText}>{area.intro}</p>}
              <ul className={s.chips}>
                {area.bring?.map((item) => (
                  <li key={item} className={s.chip}>
                    {item}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { NestleAreas };
export type { Area };
