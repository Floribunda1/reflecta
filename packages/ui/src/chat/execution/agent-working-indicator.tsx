import type { ComponentProps } from "react";
import { motion, MotionConfig } from "motion/react";
import { cn } from "#lib/utils";

export type AgentWorkingVariant = "grid" | "drive" | "dots" | "orbit";

/* 还原最早版本（c44d2aca）：3×3 格子 scale 脉冲（0.5→0→0.5），对角延迟错开——
 * Craft 轻量风格，克制不抢戏。variant 保留 API 兼容（视觉统一为脉冲呼吸）。 */
const cubeDelays = [0.2, 0.3, 0.4, 0.1, 0.2, 0.3, 0, 0.1, 0.2];

export function AgentWorkingIndicator({
  variant = "grid",
  className,
  ...props
}: ComponentProps<typeof motion.span> & { variant?: AgentWorkingVariant }) {
  return (
    <MotionConfig reducedMotion="user">
      <motion.span
        data-slot="agent-working-indicator"
        data-variant={variant}
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
