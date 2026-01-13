# src/api/models/splunk.py
from pydantic import BaseModel
from typing import Any, Optional

class SplunkSearchRequest(BaseModel):
    organization: str
    search: str
    earliest_time: Optional[str] = "-24h"
    latest_time: Optional[str] = "now"
    max_results: Optional[int] = 1000

class SplunkSearchResponse(BaseModel):
    success: bool = True
    results: list = []
    fields: list = []
    preview: Optional[str] = None
    result_count: int = 0
    generated_spl: Optional[str] = None