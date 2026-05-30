# backend/api/app/storage/s3.py
# AWS S3 storage adapter for the backend API endpoints.
# boto3 is already a declared dependency in the backend pyproject.toml.

from .base import StorageAdapter


class S3Adapter(StorageAdapter):
    """Stores CSV files in an S3 bucket."""

    def __init__(self, bucket: str, region: str) -> None:
        import boto3  # lazy import to avoid failures in environments without AWS creds
        self._bucket = bucket
        self._client = boto3.client("s3", region_name=region)

    def read(self, file_key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=file_key)
        return response["Body"].read()

    def write(self, file_key: str, data: bytes) -> str:
        self._client.put_object(Bucket=self._bucket, Key=file_key, Body=data)
        return file_key

    def delete(self, file_key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=file_key)
