import asyncio
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

_observer = None


class FolderHandler(FileSystemEventHandler):
    def __init__(self, loop: asyncio.AbstractEventLoop, db_factory):
        self._loop = loop
        self._db_factory = db_factory

    def on_created(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                self._ingest(event.src_path), self._loop
            )

    def on_deleted(self, event):
        if not event.is_directory:
            asyncio.run_coroutine_threadsafe(
                self._remove(event.src_path), self._loop
            )

    async def _ingest(self, path: str):
        from documents.service import upload_document
        async with self._db_factory() as db:
            content = Path(path).read_bytes()
            await upload_document(db, Path(path).name, content, source="folder")

    async def _remove(self, path: str):
        from rag.pipeline import delete_file
        await delete_file(path)


def start_watcher(folders: list[str], loop: asyncio.AbstractEventLoop, db_factory):
    global _observer
    stop_watcher()
    if not folders:
        return
    _observer = Observer()
    handler = FolderHandler(loop, db_factory)
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
