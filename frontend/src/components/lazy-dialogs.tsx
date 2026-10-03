import { cloneElement, lazy, Suspense, useState, type ComponentProps, type ReactElement } from "react";
import type RealRequestDialog from "@/components/request-dialog";
import type RealOrderModal from "@/components/order-modal";

/**
 * The order and request dialogs pull in the dialog library (@base-ui, focus
 * trapping, …) — the heaviest part of the storefront bundle, yet only needed
 * once someone actually taps "order". These wrappers render just the trigger;
 * the dialog code is fetched on hover/touch (so it is usually ready) and the
 * real dialog mounts, already open, on the first click.
 */
const loadRequest = () => import("@/components/request-dialog");
const loadOrder = () => import("@/components/order-modal");
const RequestImpl = lazy(loadRequest);
const OrderImpl = lazy(loadOrder);

const DEFAULT_REQUEST_TRIGGER = (
  <span className="inline-flex h-9 cursor-pointer items-center justify-center rounded-lg border border-gold/30 bg-gold-light/40 px-5 text-sm font-medium text-foreground transition-colors hover:bg-gold-light/70">
    اطلب كتابًا
  </span>
);

/** Render `trigger` as an accessible button that activates the real dialog. */
function useLazyTrigger(trigger: ReactElement, preload: () => Promise<unknown>) {
  const [active, setActive] = useState(false);
  const open = () => setActive(true);
  const warm = () => void preload().catch(() => undefined);
  const props = trigger.props as Record<string, unknown>;
  const element = cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    role: "button",
    tabIndex: 0,
    "aria-haspopup": "dialog",
    onClick: open,
    onPointerEnter: warm,
    onTouchStart: warm,
    onFocus: warm,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
      (props.onKeyDown as ((e: React.KeyboardEvent) => void) | undefined)?.(e);
    },
  });
  return { active, element };
}

export function RequestDialog(props: Omit<ComponentProps<typeof RealRequestDialog>, "initialOpen">) {
  const trigger = props.trigger ?? DEFAULT_REQUEST_TRIGGER;
  const { active, element } = useLazyTrigger(trigger, loadRequest);
  if (!active) return element;
  return (
    <Suspense fallback={element}>
      <RequestImpl {...props} trigger={trigger} initialOpen />
    </Suspense>
  );
}

export function OrderModal(props: Omit<ComponentProps<typeof RealOrderModal>, "initialOpen">) {
  const { active, element } = useLazyTrigger(props.trigger, loadOrder);
  if (!active) return element;
  return (
    <Suspense fallback={element}>
      <OrderImpl {...props} initialOpen />
    </Suspense>
  );
}
