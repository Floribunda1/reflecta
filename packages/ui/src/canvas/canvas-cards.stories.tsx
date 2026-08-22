import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { StoryCase, StoryShowcase } from "../../.storybook/story-showcase";
import {
  CanvasGroupCard,
  CanvasRefCard,
  CanvasTextCard,
  CanvasUnderstandingCard,
} from "./canvas-cards";
import {
  deletedCanvas,
  deletedUnderstanding,
  irrigationUnderstanding,
  longUnderstanding,
  nestedPreviewDocument,
  nightShiftCanvas,
  titleOnlyCanvas,
  unnamedUnderstanding,
} from "./canvas-story-fixtures";

function CardFrame({
  label,
  width = "w-[260px]",
  height = "h-[220px]",
  padded = false,
  children,
}: {
  label: string;
  width?: string;
  height?: string;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className={`${width} ${height} ${padded ? "relative overflow-visible pt-7" : ""}`}>
        {children}
      </div>
    </div>
  );
}

function UnderstandingDemo({
  item = irrigationUnderstanding,
  selected = false,
  readonly = false,
  multiSelected = false,
  color,
  deleted,
}: {
  item?: typeof irrigationUnderstanding;
  selected?: boolean;
  readonly?: boolean;
  multiSelected?: boolean;
  color?: string;
  deleted?: boolean;
}) {
  const [paint, setPaint] = useState(color);
  const [lastAction, setLastAction] = useState("双击打开详情，选中后可改色或删除");
  return (
    <div className="grid gap-2">
      <div className="h-[220px] w-[260px]">
        <CanvasUnderstandingCard
          id={item.id}
          understandingId={item.id}
          title={item.title}
          body={item.body}
          deleted={deleted ?? item.deleted}
          color={paint}
          selected={selected}
          readonly={readonly}
          multiSelected={multiSelected}
          onEdit={() => setLastAction("编辑")}
          onRemove={() => setLastAction("删除")}
          onColorChange={setPaint}
          onOpenDetail={() => setLastAction("打开详情")}
        />
      </div>
      <p className="text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function TextDemo({
  text = "主管压力在换班后回落到正常区间。",
  selected = false,
  readonly = false,
  color,
}: {
  text?: string;
  selected?: boolean;
  readonly?: boolean;
  color?: string;
}) {
  const [value, setValue] = useState(text);
  const [paint, setPaint] = useState(color);
  return (
    <div className="h-[140px] w-[220px]">
      <CanvasTextCard
        id="text-demo"
        text={value}
        color={paint}
        selected={selected}
        readonly={readonly}
        onTextChange={setValue}
        onColorChange={setPaint}
      />
    </div>
  );
}

function GroupDemo({
  label = "夜班观察",
  selected = false,
  readonly = false,
  color,
}: {
  label?: string;
  selected?: boolean;
  readonly?: boolean;
  color?: string;
}) {
  const [name, setName] = useState(label);
  const [paint, setPaint] = useState(color);
  const [lastAction, setLastAction] = useState("双击组名可编辑；右键可解组或删除");
  return (
    <div className="grid gap-2">
      <div className="relative h-[160px] w-[280px] pt-7">
        <CanvasGroupCard
          id="group-demo"
          label={name}
          color={paint}
          selected={selected}
          readonly={readonly}
          onLabelChange={setName}
          onColorChange={setPaint}
          onUngroup={() => setLastAction("解组")}
          onDelete={() => setLastAction("删除组")}
        />
      </div>
      <p className="text-xs text-muted-foreground">{lastAction}</p>
    </div>
  );
}

function CanvasCardsShowcase() {
  return (
    <StoryShowcase
      title="Canvas Cards"
      description="验收四种画布卡片的独立视觉契约：理解、文本、组、画布引用。比较选中、着色、删除占位、只读和内容边界；操作条与颜色可直接交互。"
    >
      <StoryCase
        title="理解卡"
        description="标题、Markdown 正文、无标题占位、引用删除占位并排比较。选中后出现操作条。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardFrame label="典型正文">
            <UnderstandingDemo selected />
          </CardFrame>
          <CardFrame label="无标题">
            <UnderstandingDemo item={unnamedUnderstanding} selected />
          </CardFrame>
          <CardFrame label="引用已删除">
            <UnderstandingDemo item={deletedUnderstanding} deleted selected />
          </CardFrame>
        </div>
      </StoryCase>

      <StoryCase title="理解卡内容边界" description="长标题截断、正文内部滚动、着色与只读。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardFrame label="长标题与长正文" height="h-[280px]">
            <div className="h-[280px] w-[260px]">
              <CanvasUnderstandingCard
                id={longUnderstanding.id}
                understandingId={longUnderstanding.id}
                title={longUnderstanding.title}
                body={longUnderstanding.body}
                selected
                onColorChange={() => undefined}
              />
            </div>
          </CardFrame>
          <CardFrame label="着色">
            <UnderstandingDemo selected color="chart-2" />
          </CardFrame>
          <CardFrame label="只读（无操作条）">
            <UnderstandingDemo readonly selected />
          </CardFrame>
        </div>
      </StoryCase>

      <StoryCase
        title="文本卡"
        description="预览、空白、长内容和选中编辑。双击进入编辑，失焦提交。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-4">
          <CardFrame label="预览" width="w-[220px]" height="h-[140px]">
            <TextDemo selected />
          </CardFrame>
          <CardFrame label="空白" width="w-[220px]" height="h-[140px]">
            <TextDemo text="" selected />
          </CardFrame>
          <CardFrame label="长正文" width="w-[220px]" height="h-[140px]">
            <TextDemo
              text={"回水温度、基质含水率和主管压力需要放在同一观察窗里比较，避免只看瞬时尖峰。".repeat(
                3,
              )}
              selected
            />
          </CardFrame>
          <CardFrame label="着色 / 只读" width="w-[220px]" height="h-[140px]">
            <TextDemo selected readonly color="chart-3" />
          </CardFrame>
        </div>
      </StoryCase>

      <StoryCase title="组" description="组名徽章、空名占位、长名称截断、着色。双击组名编辑。">
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardFrame label="典型组名" width="w-[280px]" height="h-[200px]" padded>
            <GroupDemo selected />
          </CardFrame>
          <CardFrame label="未命名" width="w-[280px]" height="h-[200px]" padded>
            <GroupDemo label="" selected />
          </CardFrame>
          <CardFrame label="长名称与着色" width="w-[280px]" height="h-[200px]" padded>
            <GroupDemo label="夜班联调、异常复验与下一观察窗的临时分组" selected color="chart-1" />
          </CardFrame>
        </div>
      </StoryCase>

      <StoryCase
        title="画布引用卡"
        description="内嵌预览、仅标题占位、目标已删除。双击打开由上层处理。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardFrame label="内嵌预览" width="w-[240px]" height="h-[160px]">
            <CanvasRefCard
              id="ref-preview"
              canvasRefId={nightShiftCanvas.id}
              title={nightShiftCanvas.title}
              document={nestedPreviewDocument}
              selected
            />
          </CardFrame>
          <CardFrame label="预览未加载" width="w-[240px]" height="h-[160px]">
            <CanvasRefCard
              id="ref-title"
              canvasRefId={titleOnlyCanvas.id}
              title={titleOnlyCanvas.title}
              selected
            />
          </CardFrame>
          <CardFrame label="目标已删除" width="w-[240px]" height="h-[160px]">
            <CanvasRefCard
              id="ref-deleted"
              canvasRefId={deletedCanvas.id}
              title={deletedCanvas.title}
              deleted
              selected
            />
          </CardFrame>
        </div>
      </StoryCase>

      <StoryCase
        title="选中与操作条"
        description="单选显示操作条；多选和只读都隐藏。同一张理解卡并排比较。"
      >
        <div className="grid items-start gap-8 lg:grid-cols-3">
          <CardFrame label="单选">
            <UnderstandingDemo selected />
          </CardFrame>
          <CardFrame label="多选（操作条隐藏）">
            <UnderstandingDemo selected multiSelected />
          </CardFrame>
          <CardFrame label="未选中">
            <UnderstandingDemo />
          </CardFrame>
        </div>
      </StoryCase>
    </StoryShowcase>
  );
}

const meta = {
  title: "Canvas/基本组件",
  component: CanvasUnderstandingCard,
  parameters: {
    layout: "padded",
  },
  args: {
    id: irrigationUnderstanding.id,
    title: irrigationUnderstanding.title,
    body: irrigationUnderstanding.body,
    onEdit: () => undefined,
    onRemove: () => undefined,
    onColorChange: () => undefined,
    onOpenDetail: () => undefined,
  },
} satisfies Meta<typeof CanvasUnderstandingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CanvasCardsStory: Story = {
  name: "Canvas Cards",
  render: () => <CanvasCardsShowcase />,
};
