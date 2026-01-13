"""API routes for documentation."""

import os
from fastapi import APIRouter, HTTPException, Depends
from src.api.dependencies import require_viewer

router = APIRouter()

@router.get("/api/docs", dependencies=[Depends(require_viewer)])
async def get_documentation():
    """Get the user guide documentation."""
    docs_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "docs", "USER_GUIDE.md")

    try:
        with open(docs_path, 'r', encoding='utf-8') as f:
            content = f.read()

        return {"content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Documentation file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading documentation: {str(e)}")
