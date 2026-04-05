import pytest
from unittest.mock import patch, AsyncMock


@pytest.mark.asyncio
async def test_list_documents_empty(client):
    resp = await client.get("/documents")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_upload_document(client, tmp_path):
    test_file = tmp_path / "test.txt"
    test_file.write_text("Hello RAG world")

    with patch("documents.service.ingest_file", new_callable=AsyncMock):
        resp = await client.post(
            "/documents/upload",
            files={"file": ("test.txt", test_file.read_bytes(), "text/plain")},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "test.txt"
    assert data["status"] == "processing"


@pytest.mark.asyncio
async def test_delete_document(client, tmp_path):
    test_file = tmp_path / "del.txt"
    test_file.write_text("delete me")

    with patch("documents.service.ingest_file", new_callable=AsyncMock):
        upload = await client.post(
            "/documents/upload",
            files={"file": ("del.txt", test_file.read_bytes(), "text/plain")},
        )
    doc_id = upload.json()["id"]

    with patch("documents.service.delete_file", new_callable=AsyncMock):
        resp = await client.delete(f"/documents/{doc_id}")
    assert resp.status_code == 200
