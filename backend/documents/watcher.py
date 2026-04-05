import asyncio
import logging
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

logger = logging.getLogger(__name__)

_observer = None


class FolderHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def on_created(self, event):
        pass  # Files are read on-demand via the read_file tool

    def on_deleted(self, event):
        pass


def start_watcher(folders: list[str], loop: asyncio.AbstractEventLoop, db_factory=None):
    global _observer
    stop_watcher()
    if not folders:
        return
    _observer = Observer()
    handler = FolderHandler(loop)
    for folder in folders:
        if Path(folder).is_dir():
            _observer.schedule(handler, folder, recursive=True)
    _observer.start()


def stop_watcher():
    global _observer
    if _observer and _observer.is_alive():
        _observer.stop()
        _observer.join()
    _observer = None
