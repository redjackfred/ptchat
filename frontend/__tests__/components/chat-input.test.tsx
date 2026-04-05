import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatInput } from "@/components/chat/chat-input";

describe("ChatInput", () => {
  it("calls onSend with the message when Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/message/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledWith("Hello");
  });

  it("does not send on Shift+Enter", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} disabled={false} />);
    const textarea = screen.getByPlaceholderText(/message/i);
    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it("is disabled when disabled=true", () => {
    render(<ChatInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
