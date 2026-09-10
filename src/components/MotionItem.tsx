import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export function MotionItem({
  children,
  className,
  delay = 0,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? {} : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduce || !hover ? undefined : { scale: 1.01 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
