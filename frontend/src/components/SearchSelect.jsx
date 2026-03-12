import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";


// SearchSelect with portal-based dropdown to fix z-index/overflow issues
export default function SearchSelect({
    value,
    onChange,
    options,
    placeholder = "Pilih...",
    allLabel = "Semua",
  }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);
  
    const selected = options.find((o) => o.value === value);
    const filtered = options.filter((o) => {
      const hay = `${o.label} ${o.subLabel || ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  
    const openDropdown = () => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropdownHeight = 280;
  
        if (spaceBelow < dropdownHeight) {
          setDropdownStyle({
            position: "fixed",
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
          });
        } else {
          setDropdownStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
          });
        }
      }
      setOpen(true);
    };
  
    useEffect(() => {
      if (!open) return;
      const handler = (e) => {
        const insideButton = buttonRef.current?.contains(e.target);
        const insideDropdown = dropdownRef.current?.contains(e.target);
        if (!insideButton && !insideDropdown) {
          setOpen(false);
          setQ("");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);
  
    const dropdown = open
      ? createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-slate-800 border border-slate-700 rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="p-2 border-b border-slate-700">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="max-h-56 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); setQ(""); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 ${
                  value === "" ? "text-blue-300" : "text-slate-200"
                }`}
              >
                {allLabel}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQ(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700/50 ${
                    o.value === value ? "text-blue-300" : "text-slate-200"
                  }`}
                >
                  <div className="font-medium">{o.label}</div>
                  {o.subLabel && (
                    <div className="text-[11px] text-slate-400">{o.subLabel}</div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-400">Tidak ada hasil</div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;
  
    return (
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? (setOpen(false), setQ("")) : openDropdown())}
          className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-left"
        >
          <span className={selected ? "text-white" : "text-slate-400"}>
            {selected ? selected.label : allLabel}
          </span>
        </button>
        {dropdown}
      </div>
    );
  };