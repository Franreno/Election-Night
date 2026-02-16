"""
init config file for models module
"""

from app.models.constituency import Constituency
from app.models.region import Region
from app.models.result import Result
from app.models.result_history import ResultHistory
from app.models.upload_log import UploadLog

__all__ = ["Constituency", "Region", "Result", "ResultHistory", "UploadLog"]
