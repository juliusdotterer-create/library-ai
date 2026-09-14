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
  // Verzögerungen deckeln, damit Listen sofort nutzbar sind.
  const d = Math.min(delay, 0.08);
  return (
    <motion.div
      initial={reduce ? {} : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.14, delay: reduce ? 0 : d, ease: [0.25, 0.1, 0.25, 1] }}
      whileHover={reduce || !hover ? undefined : { scale: 1.01 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      style={{ touchAction: "manipulation" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
