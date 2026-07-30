import { motion, MotionConfig } from "motion/react";
import { cn } from "#lib/utils";

const cubeDelays = [0.2, 0.3, 0.4, 0.1, 0.2, 0.3, 0, 0.1, 0.2];

export function AgentWorkingIndicator({
  className,
  ...props
}: React.ComponentProps<typeof motion.span>) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        data-slot="agent-working-indicator"
        className={cn(
          "grid size-4 shrink-0 grid-cols-3 gap-px text-muted-foreground/70",
          className,
        )}
        {...props}
      >
        {cubeDelays.map((delay, index) => (
          <motion.span
            key={index}
            className="bg-current"
            animate={{ scale: [0.5, 0, 0.5, 0.5] }}
            transition={{
              delay,
              duration: 1.3,
              repeat: Infinity,
              ease: "easeInOut",
              times: [0, 0.35, 0.7, 1],
            }}
          />
        ))}
      </motion.span>
    </MotionConfig>
  );
}
