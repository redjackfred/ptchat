"""
Tools available to the AI during chat.
Currently: read_file — reads a file from watched folders.
"""
import os
from pathlib import Path

READ_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_file",
        "description": (
            "Read the full text content of a file. "
            "Use this when the user asks about a specific file or wants its contents."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Absolute path to the file.",
                }
            },
            "required": ["path"],
        },
    },
}

ALL_TOOLS = [READ_FILE_TOOL]


def execute_tool(name: str, args: dict) -> str:
    if name == "read_file":
        return _read_file(args.get("path", ""))
    return f"Unknown tool: {name}"


def _read_file(path: str) -> str:
    from settings.service import SettingsService

    watched: list[str] = SettingsService().get().get("watched_folders", [])
    abs_path = os.path.realpath(path)

    if not any(abs_path.startswith(os.path.realpath(f)) for f in watched):
        return f"Access denied: {path} is not inside a monitored folder."

    p = Path(abs_path)
    if not p.exists():
        return f"File not found: {path}"
    if not p.is_file():
        return f"Not a file: {path}"

    try:
        # For images, return a note instead of binary garbage
        if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"}:
            return f"[Image file: {p.name} — binary content, cannot display as text]"
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception as e:
        return f"Error reading {path}: {e}"


def list_folder_files() -> dict[str, list[str]]:
    """Scan all watched folders and return {folder_path: [file_paths]}."""
    from settings.service import SettingsService

    watched: list[str] = SettingsService().get().get("watched_folders", [])
    result: dict[str, list[str]] = {}
    for folder in watched:
        root = Path(folder)
        if not root.is_dir():
            continue
        files = sorted(
            str(p) for p in root.rglob("*")
            if p.is_file() and not p.name.startswith(".")
        )
        if files:
            result[folder] = files
    return result
