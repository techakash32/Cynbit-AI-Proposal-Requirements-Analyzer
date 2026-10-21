import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from 'react';
import * as RadixLabel from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => <input ref={ref} className={cn('input', className)} {...props} />);
Input.displayName = 'Input';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn('textarea', className)} {...props} />);
Textarea.displayName = 'Textarea';
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) { return <RadixLabel.Root className={cn('block text-sm font-medium text-copy', className)} {...props} />; }
