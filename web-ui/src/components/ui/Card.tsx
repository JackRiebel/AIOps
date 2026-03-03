'use client';

/**
 * Base Card component with variants.
 *
 * This is the foundational card component used throughout the application.
 * Specialized cards (StatCard, DeviceCard, etc.) build on top of this.
 */

import React, { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * Card variant styles using class-variance-authority.
 */
const cardVariants = cva(
  'rounded-lg border',
  {
    variants: {
      variant: {
        default: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow',
        elevated: 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg',
        outlined: 'bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 shadow-none',
        ghost: 'shadow-none border-none bg-transparent',
        gradient: 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md',
    },
  }
);

/**
 * Card component props.
 */
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  /** Make card interactive with hover effects */
  interactive?: boolean;
}

/**
 * Base Card component.
 *
 * @example
 * <Card variant="elevated" padding="lg">
 *   <CardHeader>
 *     <CardTitle>Title</CardTitle>
 *     <CardDescription>Description</CardDescription>
 *   </CardHeader>
 *   <CardContent>Content here</CardContent>
 *   <CardFooter>Footer actions</CardFooter>
 * </Card>
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, padding }),
        interactive && 'cursor-pointer transition-shadow hover:shadow-lg dark:hover:shadow-slate-900/50',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

/**
 * Card header section.
 */
export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

/**
 * Card title component.
 */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-white', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

/**
 * Card description component.
 */
export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

/**
 * Card content section.
 */
export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

/**
 * Card footer section.
 */
export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

/**
 * Convenience export of all card components.
 */
export default {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
