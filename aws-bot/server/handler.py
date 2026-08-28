"""Lambda entry point. See app/main.py for the actual FastAPI app."""

from aws_xray_sdk.core import patch_all
from mangum import Mangum

from app.main import app

# Patches boto3 so the S3 (memory) and Bedrock calls each show up as their
# own subsegment in X-Ray, instead of one opaque Lambda-duration blob.
patch_all()

handler = Mangum(app)
