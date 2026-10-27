# deploy/terraform/modules/object_storage/main.tf
# Sovereign Encrypted Medical Scans, Preauth Attachments & Backup Storage
# Compliance: Kenya Health Act 2017 (10-Year Lock), Data Protection Act 2019 (Sec 41 & 50)

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "kms_storage_key_arn" {
  type        = string
  description = "KMS CMK ARN for storage encryption"
}

variable "kms_backup_key_arn" {
  type        = string
  description = "KMS CMK ARN for backup archive encryption"
}

# 1. Access Logging Bucket
resource "aws_s3_bucket" "logging_bucket" {
  bucket        = "afyapoa-${var.environment}-s3-access-logs"
  force_destroy = false

  tags = {
    Name        = "afyapoa-${var.environment}-s3-access-logs"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_public_access_block" "logging_public_block" {
  bucket = aws_s3_bucket.logging_bucket.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# 2. Primary Medical Imaging & Attachment Bucket
resource "aws_s3_bucket" "medical_scans" {
  bucket        = "afyapoa-${var.environment}-medical-scans"
  force_destroy = false

  tags = {
    Name        = "afyapoa-${var.environment}-medical-scans"
    Environment = var.environment
    DataClass   = "Sensitive-Health-Data"
  }
}

resource "aws_s3_bucket_versioning" "medical_scans_versioning" {
  bucket = aws_s3_bucket.medical_scans.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "medical_scans_encryption" {
  bucket = aws_s3_bucket.medical_scans.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_storage_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "medical_scans_public_block" {
  bucket = aws_s3_bucket.medical_scans.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_logging" "medical_scans_logging" {
  bucket        = aws_s3_bucket.medical_scans.id
  target_bucket = aws_s3_bucket.logging_bucket.id
  target_prefix = "medical-scans/"
}

# 10-Year Statutory Retention Lifecycle Rule (Health Act 2017)
resource "aws_s3_bucket_lifecycle_configuration" "medical_scans_lifecycle" {
  bucket = aws_s3_bucket.medical_scans.id

  rule {
    id     = "10-year-medical-retention"
    status = "Enabled"

    transition {
      days          = 180
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 1825 # 5 Years
      storage_class = "GLACIER"
    }

    # Objects strictly retained for 3,650 days (10 years)
    expiration {
      days = 3650
    }
  }
}

# 3. Encrypted Database WAL & Disaster Recovery Backup Bucket
resource "aws_s3_bucket" "backup_archive" {
  bucket        = "afyapoa-${var.environment}-db-backups"
  force_destroy = false

  tags = {
    Name        = "afyapoa-${var.environment}-db-backups"
    Environment = var.environment
    DataClass   = "Disaster-Recovery-Archive"
  }
}

resource "aws_s3_bucket_versioning" "backup_versioning" {
  bucket = aws_s3_bucket.backup_archive.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "backup_encryption" {
  bucket = aws_s3_bucket.backup_archive.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = var.kms_backup_key_arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "backup_public_block" {
  bucket = aws_s3_bucket.backup_archive.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Outputs
output "medical_scans_bucket_name" {
  value = aws_s3_bucket.medical_scans.bucket
}

output "medical_scans_bucket_arn" {
  value = aws_s3_bucket.medical_scans.arn
}

output "backup_bucket_name" {
  value = aws_s3_bucket.backup_archive.bucket
}

output "backup_bucket_arn" {
  value = aws_s3_bucket.backup_archive.arn
}
