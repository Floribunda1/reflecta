import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import {
  denseParticipationAssets,
  denseParticipationDays,
  emptyParticipationAssets,
  emptyParticipationDays,
  typicalParticipationAssets,
  typicalParticipationCounts,
  typicalParticipationDays,
  typicalParticipationDetail,
} from "./capture-story-fixtures";
import { ParticipationOverview } from "./participation-overview";

function OverviewFrame({ children, width }: { children: ReactNode; width?: string }) {
  return <div className={width ? `${width} max-w-full` : "w-full"}>{children}</div>;
}

function ParticipationOverviewShowcase() {
  return (
    <StoryShowcase
      title="Participation Overview"
      description="捕获页顶部足迹：资产存量与 365 天热力图同排。点击有色格子打开当天对话和理解。"
    >
      <StoryCase
        title="空足迹"
        description="资产为零，全年格子都是空天。悬停显示无参与；点击打开空明细。"
      >
        <OverviewFrame>
          <ParticipationOverview
            assets={emptyParticipationAssets}
            days={emptyParticipationDays}
            resolveDayDetail={() => ({ sessions: [], understandings: [] })}
          />
        </OverviewFrame>
      </StoryCase>

      <StoryCase
        title="稀疏参与"
        description="一年里只有若干天有记录。悬停看细分；点击 8 月 24 日或 6 月 18 日打开当天明细。窄容器下热力图横向滚动。"
      >
        <div className="grid items-start gap-8">
          <OverviewFrame>
            <ParticipationOverview
              assets={typicalParticipationAssets}
              days={typicalParticipationDays}
              getDayCounts={typicalParticipationCounts}
              resolveDayDetail={typicalParticipationDetail}
            />
          </OverviewFrame>
          <OverviewFrame width="w-[420px]">
            <ParticipationOverview
              assets={typicalParticipationAssets}
              days={typicalParticipationDays}
              getDayCounts={typicalParticipationCounts}
              resolveDayDetail={typicalParticipationDetail}
            />
          </OverviewFrame>
        </div>
      </StoryCase>

      <StoryCase title="高密度" description="高等级格子和大计数资产挤在同一行。">
        <OverviewFrame>
          <ParticipationOverview
            assets={denseParticipationAssets}
            days={denseParticipationDays}
            resolveDayDetail={() => ({
              sessions: [{ id: "s-dense", title: "连续复验窗口", messageCount: 12 }],
              understandings: [{ id: "u-dense", title: "模拟理解 1：极地温室第 1 轮复验记录" }],
            })}
          />
        </OverviewFrame>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Capture/基本组件",
  component: ParticipationOverview,
  parameters: {
    layout: "padded",
  },
  args: {
    assets: typicalParticipationAssets,
    days: typicalParticipationDays,
    getDayCounts: typicalParticipationCounts,
    resolveDayDetail: typicalParticipationDetail,
  },
} satisfies Meta<typeof ParticipationOverview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ParticipationOverviewStory: Story = {
  name: "Participation Overview",
  render: () => <ParticipationOverviewShowcase />,
};
