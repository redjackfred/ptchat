import uuid
from fastapi import APIRouter, Depends, UploadFile, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.session import get_db
from documents import service
from documents.schemas import DocumentOut

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
async def list_documents(db: AsyncSession = Depends(get_db)):
    return await service.list_documents(db)


@router.post("/upload", response_model=DocumentOut)
async def upload_document(file: UploadFile, db: AsyncSession = Depends(get_db)):
    content = await file.read()
    return await service.upload_document(db, file.filename, content)


@router.delete("/{doc_id}")
async def delete_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    ok = await service.delete_document(db, doc_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"ok": True}
