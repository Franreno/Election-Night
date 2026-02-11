"""
init config file for models module
"""

from app.models.constituency import Constituency
from app.models.result import Result
from app.models.upload_log import UploadLog

__all__ = ["Constituency", "Result", "UploadLog"]
