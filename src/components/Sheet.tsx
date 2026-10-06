import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { ReactNode } from "react";

export function BottomSheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-h-[92vh] max-w-[480px] border-border bg-popover">
        <div className="overflow-y-auto px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DrawerTitle className="mb-4 text-lg font-semibold text-foreground">{title}</DrawerTitle>
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="eyebrow mb-1.5 block !tracking-[0.14em]">{label}</span>
      {children}
    </label>
  );
}

export function PrimaryButton({ children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...p} className="glow mt-2 w-full rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-50">
      {children}
    </button>
  );
}
