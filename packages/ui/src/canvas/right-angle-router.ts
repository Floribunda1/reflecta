import type { CanvasEdgePortId } from "@reflecta/shared";

type Point = { x: number; y: number };
type Rect = { x: number; y: number; width: number; height: number };

export type RightAngleTerminal = {
  anchor: Point;
  bbox: Rect;
  port: CanvasEdgePortId;
};

const expand = (rect: Rect, margin: number): Rect => ({
  x: rect.x - margin,
  y: rect.y - margin,
  width: rect.width + margin * 2,
  height: rect.height + margin * 2,
});

function outsidePoint(terminal: RightAngleTerminal, margin: number): Point {
  const { anchor, bbox, port } = terminal;
  switch (port) {
    case "top":
      return { x: anchor.x, y: bbox.y - margin };
    case "right":
      return { x: bbox.x + bbox.width + margin, y: anchor.y };
    case "bottom":
      return { x: anchor.x, y: bbox.y + bbox.height + margin };
    case "left":
      return { x: bbox.x - margin, y: anchor.y };
  }
}

function inside(rect: Rect, point: Point): boolean {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.width &&
    point.y > rect.y &&
    point.y < rect.y + rect.height
  );
}

function segmentIsClear(a: Point, b: Point, rects: ReadonlyArray<Rect>): boolean {
  if (a.x === b.x) {
    return rects.every(
      (rect) =>
        a.x <= rect.x ||
        a.x >= rect.x + rect.width ||
        Math.max(a.y, b.y) <= rect.y ||
        Math.min(a.y, b.y) >= rect.y + rect.height,
    );
  }
  if (a.y === b.y) {
    return rects.every(
      (rect) =>
        a.y <= rect.y ||
        a.y >= rect.y + rect.height ||
        Math.max(a.x, b.x) <= rect.x ||
        Math.min(a.x, b.x) >= rect.x + rect.width,
    );
  }
  return false;
}

function simplify(points: ReadonlyArray<Point>): Point[] {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];
    if (previous && point.x === previous.x && point.y === previous.y) return false;
    if (!previous || !next) return true;
    return !(
      (previous.x === point.x && point.x === next.x) ||
      (previous.y === point.y && point.y === next.y)
    );
  });
}

function samePortLoop(stub: Point, port: CanvasEdgePortId, margin: number): Point[] {
  const vector =
    port === "top"
      ? { x: 0, y: -1 }
      : port === "right"
        ? { x: 1, y: 0 }
        : port === "bottom"
          ? { x: 0, y: 1 }
          : { x: -1, y: 0 };
  const perpendicular = { x: -vector.y, y: vector.x };
  const far = { x: stub.x + vector.x * margin, y: stub.y + vector.y * margin };
  return [
    stub,
    far,
    { x: far.x + perpendicular.x * margin * 2, y: far.y + perpendicular.y * margin * 2 },
    { x: stub.x + perpendicular.x * margin * 2, y: stub.y + perpendicular.y * margin * 2 },
    stub,
  ];
}

/**
 * Constant-size rectilinear visibility graph around the two terminal boxes.
 * This follows JointJS rightAngle's boundary: clear the connected elements,
 * but deliberately ignore every other canvas element.
 */
export function rightAngleRoutePoints(
  source: RightAngleTerminal,
  target: RightAngleTerminal,
  margin = 24,
): Point[] {
  const sourceStub = outsidePoint(source, margin);
  const targetStub = outsidePoint(target, margin);
  if (sourceStub.x === targetStub.x && sourceStub.y === targetStub.y) {
    return samePortLoop(sourceStub, source.port, margin);
  }

  const rects = [expand(source.bbox, margin), expand(target.bbox, margin)];
  const xs = [
    sourceStub.x,
    targetStub.x,
    ...rects.flatMap((rect) => [rect.x, rect.x + rect.width]),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const ys = [
    sourceStub.y,
    targetStub.y,
    ...rects.flatMap((rect) => [rect.y, rect.y + rect.height]),
  ].filter((value, index, values) => values.indexOf(value) === index);
  const points = xs
    .flatMap((x) => ys.map((y) => ({ x, y })))
    .filter((point) => rects.every((rect) => !inside(rect, point)));
  const start = points.findIndex((point) => point.x === sourceStub.x && point.y === sourceStub.y);
  const goal = points.findIndex((point) => point.x === targetStub.x && point.y === targetStub.y);
  if (start < 0 || goal < 0) {
    return simplify([sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub]);
  }

  type Axis = "horizontal" | "vertical" | "start";
  type State = { point: number; axis: Axis };
  const keyOf = ({ point, axis }: State) => `${point}:${axis}`;
  const distances = new Map<string, number>([[`${start}:start`, 0]]);
  const previous = new Map<string, string>();
  const states = new Map<string, State>([[`${start}:start`, { point: start, axis: "start" }]]);
  const open = new Set<string>([`${start}:start`]);
  let result: string | undefined;

  while (open.size > 0) {
    let currentKey: string | undefined;
    let currentDistance = Number.POSITIVE_INFINITY;
    for (const key of open) {
      const distance = distances.get(key) ?? Number.POSITIVE_INFINITY;
      if (distance < currentDistance) {
        currentKey = key;
        currentDistance = distance;
      }
    }
    if (!currentKey) break;
    open.delete(currentKey);
    const current = states.get(currentKey)!;
    if (current.point === goal) {
      result = currentKey;
      break;
    }

    const from = points[current.point]!;
    points.forEach((to, point) => {
      const axis: Axis = from.x === to.x ? "vertical" : from.y === to.y ? "horizontal" : "start";
      if (axis === "start" || point === current.point || !segmentIsClear(from, to, rects)) return;
      const bend = current.axis !== "start" && current.axis !== axis ? margin : 0;
      const distance = currentDistance + Math.abs(from.x - to.x) + Math.abs(from.y - to.y) + bend;
      const next = { point, axis } satisfies State;
      const nextKey = keyOf(next);
      if (distance >= (distances.get(nextKey) ?? Number.POSITIVE_INFINITY)) return;
      distances.set(nextKey, distance);
      previous.set(nextKey, currentKey!);
      states.set(nextKey, next);
      open.add(nextKey);
    });
  }

  if (!result) {
    return simplify([sourceStub, { x: targetStub.x, y: sourceStub.y }, targetStub]);
  }
  const route: Point[] = [];
  for (let key: string | undefined = result; key; key = previous.get(key)) {
    route.push(points[states.get(key)!.point]!);
  }
  return simplify(route.reverse());
}
