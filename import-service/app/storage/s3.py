# import-service/app/storage/s3.py
# AWS S3 storage adapter (used in production).
# boto3 is imported lazily inside __init__ so local environments without
# AWS credentials do not fail on import.

from .base import StorageAdapter


class S3Adapter(StorageAdapter):
    """Stores CSV files in an S3 bucket.

    AWS credentials are read from the environment automatically by boto3:
    AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, or via IAM role when
    running on ECS/EC2.
    """

    def __init__(self, bucket: str, region: str) -> None:
        import boto3  # lazy import — only required in production
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
