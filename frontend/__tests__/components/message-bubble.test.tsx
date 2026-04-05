import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// react-markdown is ESM-only; stub it for Vitest/jsdom
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock("rehype-highlight", () => ({ default: () => {} }));

import { MessageBubble } from "@/components/chat/message-bubble";

describe("MessageBubble", () => {
  it("renders user message", () => {
    render(<MessageBubble role="user" content="Hello" streaming={false} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message with markdown wrapper", () => {
    render(<MessageBubble role="assistant" content="**bold**" streaming={false} />);
    expect(screen.getByTestId("markdown")).toBeInTheDocument();
  });

  it("shows streaming cursor when streaming=true", () => {
    render(<MessageBubble role="assistant" content="Typing..." streaming={true} />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });
});
