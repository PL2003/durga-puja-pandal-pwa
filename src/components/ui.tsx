/** Shared UI primitives — toasts, sheets, section headers, status pills. */
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useApp, type Toast } from "@/state/AppState";
import { cn } from "@/utils/cn";

export function ToastStack() {
  const { toasts } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex flex-col items-center gap-2 px-4 pt-safe">
      {toasts.map((t) => (
        <ToastPill key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastPill({ toast }: { toast: Toast }) {
  const tone =
    toast.kind === "ok"
      ? "border-jade/40 text-jade"
      : toast.kind === "err"
        ? "border-red/40 text-red"
        : "border-gold/40 text-gold-soft";
  return (
    <div
      className={cn(
        "animate-rise pointer-events-auto max-w-md rounded-xl border bg-[#221318]/95 px-4 py-2.5 text-center text-[13px] leading-snug shadow-2xl backdrop-blur",
        tone
      )}
    >
      <span className="text-ink/90">{toast.text}</span>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="display text-[19px] font-semibold tracking-wide text-gold-soft">{children}</h2>
      {right}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center" role="dialog" aria-modal>
      <button
        aria-label="Close"
        className="absolute inset-0 animate-fade bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "animate-rise relative max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#1c1014] pb-safe shadow-2xl sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-md"
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/[0.07] bg-[#1c1014]/95 px-5 pb-3 pt-4 backdrop-blur">
          <div className="display text-lg font-semibold text-gold-soft">{title}</div>
          <button onClick={onClose} className="btn-ghost h-9 w-9 !rounded-full !p-0" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(88dvh-64px)] overflow-y-auto px-5 py-4 pb-8">{children}</div>
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-full border border-white/10 bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all",
            value === o.value ? "bg-gradient-to-b from-gold-soft to-gold-deep text-[#2a1503] shadow" : "text-ink-dim hover:text-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const { online } = useApp();
  if (online) return null;
  return (
    <div className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 text-[12px] text-gold-soft animate-fade">
      <span className="h-2 w-2 animate-pulse-soft rounded-full bg-gold" />
      Offline — showing your last synchronized data.
    </div>
  );
}

export function EmptyBlock({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-gold/25 bg-gold/10 text-gold">{icon}</div>
      <div className="display text-lg font-semibold text-ink">{title}</div>
      {body ? <p className="max-w-sm text-[13px] leading-relaxed text-ink-dim">{body}</p> : null}
      {action}
    </div>
  );
}
