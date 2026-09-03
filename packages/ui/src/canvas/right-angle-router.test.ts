import { describe, expect, test } from "vitest";
import { rightAngleRoutePoints, type RightAngleTerminal } from "./right-angle-router";

const box = (x: number, y: number, width = 220, height = 120) => ({ x, y, width, height });

const anchor = (bbox: ReturnType<typeof box>, port: RightAngleTerminal["port"]) => {
  switch (port) {
    case "top":
      return { x: bbox.x + bbox.width / 2, y: bbox.y };
    case "right":
      return { x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 };
    case "bottom":
      return { x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height };
    case "left":
      return { x: bbox.x, y: bbox.y + bbox.height / 2 };
  }
};

function expectOrthogonal(source: RightAngleTerminal, target: RightAngleTerminal) {
  const route = rightAngleRoutePoints(source, target);
  const points = [source.anchor, ...route, target.anchor];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    expect(previous.x === current.x || previous.y === current.y).toBe(true);
  }
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!;
    const current = route[index]!;
    for (const bbox of [source.bbox, target.bbox]) {
      const crosses =
        previous.x === current.x
          ? previous.x > bbox.x &&
            previous.x < bbox.x + bbox.width &&
            Math.max(previous.y, current.y) > bbox.y &&
            Math.min(previous.y, current.y) < bbox.y + bbox.height
          : previous.y > bbox.y &&
            previous.y < bbox.y + bbox.height &&
            Math.max(previous.x, current.x) > bbox.x &&
            Math.min(previous.x, current.x) < bbox.x + bbox.width;
      expect(crosses).toBe(false);
    }
  }
  return route;
}

describe("rightAngleRoutePoints", () => {
  test("routes a reversed right-to-left edge around vertically stacked terminals", () => {
    const source = { anchor: { x: 520, y: 560 }, bbox: box(300, 500), port: "right" } as const;
    const target = { anchor: { x: 300, y: 100 }, bbox: box(300, 40), port: "left" } as const;
    const route = expectOrthogonal(source, target);

    expect(route[0]).toEqual({ x: 544, y: 560 });
    expect(route.at(-1)).toEqual({ x: 276, y: 100 });
  });

  test("routes aligned top ports outside the target instead of through it", () => {
    const source = { anchor: { x: 410, y: 500 }, bbox: box(300, 500), port: "top" } as const;
    const target = { anchor: { x: 410, y: 40 }, bbox: box(300, 40), port: "top" } as const;
    const route = expectOrthogonal(source, target);

    expect(route[0]).toEqual({ x: 410, y: 476 });
    expect(route.at(-1)).toEqual({ x: 410, y: 16 });
    expect(route.some((point) => point.x <= 276 || point.x >= 544)).toBe(true);
  });

  test("has no distance-dependent search limit", () => {
    const source = { anchor: { x: 220, y: 60 }, bbox: box(0, 0), port: "right" } as const;
    const target = { anchor: { x: 5000, y: 5060 }, bbox: box(5000, 5000), port: "left" } as const;

    expectOrthogonal(source, target);
  });

  test("keeps all port pairs orthogonal in every relative direction", () => {
    const sourceBox = box(300, 300);
    const targetBoxes = [
      box(300, 40),
      box(620, 40),
      box(620, 300),
      box(620, 560),
      box(300, 560),
      box(-20, 560),
      box(-20, 300),
      box(-20, 40),
    ];
    const ports = ["top", "right", "bottom", "left"] as const;

    for (const targetBox of targetBoxes) {
      for (const sourcePort of ports) {
        for (const targetPort of ports) {
          expectOrthogonal(
            { anchor: anchor(sourceBox, sourcePort), bbox: sourceBox, port: sourcePort },
            { anchor: anchor(targetBox, targetPort), bbox: targetBox, port: targetPort },
          );
        }
      }
    }
  });

  test("draws an orthogonal loop when both terminals are the same port", () => {
    const terminal = { anchor: { x: 220, y: 60 }, bbox: box(0, 0), port: "right" } as const;
    const route = expectOrthogonal(terminal, terminal);

    expect(route).toHaveLength(5);
    expect(route[0]).toEqual(route.at(-1));
  });
});
