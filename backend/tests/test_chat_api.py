import pytest


@pytest.mark.asyncio
async def test_create_session(client):
    resp = await client.post("/sessions", json={
        "name": "Test Chat",
        "llm_provider": "ollama",
        "llm_model": "llama3",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Chat"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_sessions(client):
    await client.post("/sessions", json={
        "name": "Session A", "llm_provider": "ollama", "llm_model": "llama3"
    })
    resp = await client.get("/sessions")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


@pytest.mark.asyncio
async def test_get_messages_empty(client):
    sess = await client.post("/sessions", json={
        "name": "Msg Test", "llm_provider": "ollama", "llm_model": "llama3"
    })
    sid = sess.json()["id"]
    resp = await client.get(f"/sessions/{sid}/messages")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_delete_session(client):
    sess = await client.post("/sessions", json={
        "name": "Del Me", "llm_provider": "ollama", "llm_model": "llama3"
    })
    sid = sess.json()["id"]
    resp = await client.delete(f"/sessions/{sid}")
    assert resp.status_code == 200
    check = await client.get(f"/sessions/{sid}/messages")
    assert check.status_code == 404
