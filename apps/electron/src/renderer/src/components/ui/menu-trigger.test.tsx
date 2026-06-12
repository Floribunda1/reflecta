import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { Button } from "./button";
import { ContextMenu, ContextMenuTrigger } from "./context-menu";
import { DropdownMenu, DropdownMenuTrigger } from "./dropdown-menu";

describe("menu triggers", () => {
  test("dropdown trigger supports asChild without nesting buttons", () => {
    const html = renderToStaticMarkup(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button">Open</Button>
        </DropdownMenuTrigger>
      </DropdownMenu>,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain("asChild");
  });

  test("context menu trigger supports asChild without leaking the prop", () => {
    const html = renderToStaticMarkup(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <button type="button">Open</button>
        </ContextMenuTrigger>
      </ContextMenu>,
    );

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain("asChild");
  });
});
