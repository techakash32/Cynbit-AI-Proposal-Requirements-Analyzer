import type { HTMLAttributes, ReactNode } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as SelectPrimitive from '@radix-ui/react-select';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export function DialogContent({ children, className, ...props }: DialogPrimitive.DialogContentProps) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay" /><DialogPrimitive.Content className={cn('dialog-content', className)} {...props}>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>;
}
export function DialogTitle({ className, ...props }: DialogPrimitive.DialogTitleProps) { return <DialogPrimitive.Title className={cn('text-xl font-semibold text-emphasis', className)} {...props} />; }
export function DialogDescription({ className, ...props }: DialogPrimitive.DialogDescriptionProps) { return <DialogPrimitive.Description className={cn('mt-2 text-sm text-muted-copy', className)} {...props} />; }
export const Sheet = Dialog;
export const SheetTrigger = DialogTrigger;
export const SheetClose = DialogClose;
export const SheetTitle = DialogTitle;
export function SheetContent({ children, className, ...props }: DialogPrimitive.DialogContentProps) {
  return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay" /><DialogPrimitive.Content className={cn('sheet-panel fixed inset-y-0 left-0 z-50 rounded-r-card border-r border-line bg-paper p-4 outline-none', className)} {...props}>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>;
}

export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) { return <TabsPrimitive.List className={cn('flex gap-1 overflow-x-auto border-b border-line', className)} {...props} />; }
export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) { return <TabsPrimitive.Trigger className={cn('border-b-2 border-transparent px-3 py-2 text-sm text-muted-copy transition-colors hover:text-copy data-[state=active]:border-action data-[state=active]:font-semibold data-[state=active]:text-emphasis', className)} {...props} />; }
export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) { return <TabsPrimitive.Content className={cn('pt-4 outline-none', className)} {...props} />; }

export function Switch({ className, ...props }: SwitchPrimitive.SwitchProps) {
  return <SwitchPrimitive.Root className={cn('relative h-6 w-11 rounded-pill border border-line bg-soft data-[state=checked]:border-action data-[state=checked]:bg-action disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}><SwitchPrimitive.Thumb className="block h-4 w-4 translate-x-1 rounded-pill bg-paper transition-transform data-[state=checked]:translate-x-6" /></SwitchPrimitive.Root>;
}
export function Checkbox({ className, ...props }: CheckboxPrimitive.CheckboxProps) {
  return <CheckboxPrimitive.Root className={cn('grid h-5 w-5 place-items-center rounded-control border border-line bg-paper data-[state=checked]:border-action data-[state=checked]:bg-action disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}><CheckboxPrimitive.Indicator><Check size={14} className="text-paper" /></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root>;
}
export const RadioGroup = RadioGroupPrimitive.Root;
export function RadioGroupItem({ className, ...props }: RadioGroupPrimitive.RadioGroupItemProps) { return <RadioGroupPrimitive.Item className={cn('grid h-5 w-5 place-items-center rounded-pill border border-line bg-paper data-[state=checked]:border-action', className)} {...props}><RadioGroupPrimitive.Indicator className="h-2.5 w-2.5 rounded-pill bg-action" /></RadioGroupPrimitive.Item>; }

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, ...props }: SelectPrimitive.SelectTriggerProps) { return <SelectPrimitive.Trigger className={cn('select inline-flex items-center justify-between gap-2', className)} {...props}><SelectPrimitive.Value /> <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon></SelectPrimitive.Trigger>; }
export function SelectContent({ children, className, ...props }: SelectPrimitive.SelectContentProps) { return <SelectPrimitive.Portal><SelectPrimitive.Content className={cn('z-50 overflow-hidden rounded-control border border-line bg-paper p-1 shadow-sm', className)} {...props}><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>; }
export function SelectItem({ children, className, ...props }: SelectPrimitive.SelectItemProps) { return <SelectPrimitive.Item className={cn('relative flex cursor-pointer items-center rounded-control py-2 pl-8 pr-3 text-sm outline-none hover:bg-soft focus:bg-soft data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props}><SelectPrimitive.ItemIndicator className="absolute left-2"><Check size={14} /></SelectPrimitive.ItemIndicator><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>; }

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export function PopoverContent({ className, ...props }: PopoverPrimitive.PopoverContentProps) { return <PopoverPrimitive.Portal><PopoverPrimitive.Content className={cn('z-50 rounded-control border border-line bg-paper p-4 shadow-sm outline-none', className)} {...props} /></PopoverPrimitive.Portal>; }
export const Accordion = AccordionPrimitive.Root;
export function AccordionItem({ className, ...props }: AccordionPrimitive.AccordionItemProps) { return <AccordionPrimitive.Item className={cn('border-b border-line', className)} {...props} />; }
export function AccordionTrigger({ children, className, ...props }: AccordionPrimitive.AccordionTriggerProps) { return <AccordionPrimitive.Header><AccordionPrimitive.Trigger className={cn('flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-medium hover:text-emphasis', className)} {...props}>{children}<ChevronRight className="transition-transform data-[state=open]:rotate-90" size={16} /></AccordionPrimitive.Trigger></AccordionPrimitive.Header>; }
export function AccordionContent({ children, className, ...props }: AccordionPrimitive.AccordionContentProps) { return <AccordionPrimitive.Content className={cn('overflow-hidden pb-4 text-sm text-muted-copy', className)} {...props}>{children}</AccordionPrimitive.Content>; }

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export function DropdownMenuContent({ className, ...props }: DropdownPrimitive.DropdownMenuContentProps) { return <DropdownPrimitive.Portal><DropdownPrimitive.Content className={cn('dropdown-menu-content z-50 rounded-control border border-line bg-paper p-1 shadow-sm', className)} {...props} /></DropdownPrimitive.Portal>; }
export function DropdownMenuItem({ className, ...props }: DropdownPrimitive.DropdownMenuItemProps) { return <DropdownPrimitive.Item className={cn('cursor-pointer rounded-control px-3 py-2 text-sm outline-none hover:bg-soft focus:bg-soft data-[disabled]:pointer-events-none data-[disabled]:opacity-50', className)} {...props} />; }
export function DropdownMenuSeparator({ className }: { className?: string }) { return <DropdownPrimitive.Separator className={cn('my-1 h-px bg-line', className)} />; }
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;
export function TooltipContent({ className, ...props }: TooltipPrimitive.TooltipContentProps) { return <TooltipPrimitive.Portal><TooltipPrimitive.Content className={cn('rounded-control border border-line bg-paper px-3 py-2 text-xs text-copy shadow-sm', className)} {...props} /></TooltipPrimitive.Portal>; }

export function Progress({ value, max = 100, className, ...props }: { value: number; max?: number; className?: string } & HTMLAttributes<HTMLProgressElement>) { return <progress className={cn('progress', className)} value={Math.max(0, Math.min(max, value))} max={max} aria-label="Progress" {...props} />; }
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) { return <div aria-hidden="true" className={cn('skeleton animate-pulse rounded-control bg-soft', className)} {...props} />; }
export function ScrollArea({ children, className, ...props }: { children: ReactNode; className?: string } & ScrollAreaPrimitive.ScrollAreaProps) { return <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}><ScrollAreaPrimitive.Viewport className="h-full w-full rounded-control">{children}</ScrollAreaPrimitive.Viewport><ScrollAreaPrimitive.Scrollbar orientation="vertical" className="flex touch-none select-none p-1"><ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-pill bg-line" /></ScrollAreaPrimitive.Scrollbar><ScrollAreaPrimitive.Corner /></ScrollAreaPrimitive.Root>; }
export function Table({ children, className }: { children: ReactNode; className?: string }) { return <div className={cn('table-wrap', className)}><table>{children}</table></div>; }
