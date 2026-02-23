import React, { useCallback, useId, useMemo, useRef, useState } from "react";

import { Badge, Button, Card, CardBody, CardHeader, cx } from "./ui";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function FileDropzone({
  title,
  description,
  file,
  setFile,
  disabled,
  maxBytes,
  acceptedLabel = "PDF",
}: {
  title: string;
  description: string;
  file: File | null;
  setFile: (file: File | null) => void;
  disabled?: boolean;
  maxBytes: number;
  acceptedLabel?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const validation = useMemo(() => {
    if (!file) return { ok: false, reason: "No file selected" };
    if (file.size > maxBytes) return { ok: false, reason: `Max ${formatBytes(maxBytes)}` };
    if (file.type && file.type !== "application/pdf") return { ok: false, reason: "Must be a PDF" };
    return { ok: true, reason: "Ready" };
  }, [file, maxBytes]);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setFile(files[0] ?? null);
    },
    [setFile],
  );

  const onDrop: React.DragEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.preventDefault();
      if (disabled) return;
      setDragActive(false);
      onFiles(e.dataTransfer.files);
    },
    [disabled, onFiles],
  );

  const onDragOver: React.DragEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      e.preventDefault();
      if (disabled) return;
      setDragActive(true);
    },
    [disabled],
  );

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = useCallback(() => {
    setDragActive(false);
  }, []);

  const statusTone = validation.ok ? "emerald" : file ? "amber" : "slate";

  return (
    <Card className={cx(disabled ? "opacity-70 hover:shadow-sm" : "")}>
      <CardHeader
        title={title}
        subtitle={description}
        right={
          <Badge tone={statusTone} className="whitespace-nowrap">
            {validation.ok ? "PDF Successfully Parsed" : file ? "Check file" : acceptedLabel}
          </Badge>
        }
      />
      <CardBody>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
        />

        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onClick={openPicker}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? openPicker() : null)}
            className={cx(
              "group grid cursor-pointer place-items-center rounded-2xl border border-dashed px-4 py-10 text-center transition",
              "focus:outline-none focus:ring-2 focus:ring-slate-900/20",
              dragActive ? "border-slate-900 bg-slate-50 shadow-sm" : "border-slate-200 bg-white/70",
              disabled ? "cursor-not-allowed" : "hover:border-slate-300 hover:bg-slate-50/60",
            )}
          >
            <div className="grid max-w-sm gap-2">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-white shadow-sm transition group-hover:shadow-md">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4" strokeLinecap="round" />
                  <path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 20h14" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-sm font-semibold text-slate-900">
                Drag & drop your {acceptedLabel} here
              </div>
              <div className="text-sm text-slate-600">or click to browse</div>
              <div className="text-xs text-slate-500">Max {formatBytes(maxBytes)}</div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3">
            <div
              className={cx(
                "group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between",
                "hover:shadow-sm",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cx("grid h-10 w-10 place-items-center rounded-xl", validation.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                  {validation.ok ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 9v4" strokeLinecap="round" />
                      <path d="M12 17h.01" strokeLinecap="round" />
                      <path
                        d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <div className="grid gap-0.5">
                  <div className="text-sm font-semibold text-slate-900">{file.name}</div>
                  <div className="text-xs text-slate-500">
                    {formatBytes(file.size)} • {validation.reason}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="secondary" onClick={openPicker} disabled={disabled}>
                  Replace
                </Button>
                <Button variant="ghost" onClick={() => setFile(null)} disabled={disabled}>
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

