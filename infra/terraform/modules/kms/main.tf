# deploy/terraform/modules/kms/main.tf
# Sovereign Key Management Service (KMS) Customer Managed Keys (CMK)
# Compliance: Data Protection Act 2019 (Section 41 Safeguards), ISO/IEC 27001

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

# 1. Database Primary Encryption Key (At-Rest + Columns)
resource "aws_kms_key" "db_encryption_key" {
  description             = "CMK for AFYA POA ${var.environment} PostgreSQL Cluster and Sensitive PII Columns"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "afyapoa-${var.environment}-db-cmk"
    Environment = var.environment
    Purpose     = "Database-Encryption"
  }
}

resource "aws_kms_alias" "db_key_alias" {
  name          = "alias/afyapoa-${var.environment}-db"
  target_key_id = aws_kms_key.db_encryption_key.key_id
}

# 2. Medical Image & Document Object Storage Encryption Key
resource "aws_kms_key" "storage_encryption_key" {
  description             = "CMK for AFYA POA ${var.environment} Medical Scans and Preauthorization Attachments"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "afyapoa-${var.environment}-storage-cmk"
    Environment = var.environment
    Purpose     = "Medical-Scans-Encryption"
  }
}

resource "aws_kms_alias" "storage_key_alias" {
  name          = "alias/afyapoa-${var.environment}-storage"
  target_key_id = aws_kms_key.storage_encryption_key.key_id
}

# 3. Encrypted Backups & Disaster Recovery Archive Key
resource "aws_kms_key" "backup_encryption_key" {
  description             = "CMK for AFYA POA ${var.environment} Encrypted Backup Archives (AES-256-GCM)"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = {
    Name        = "afyapoa-${var.environment}-backup-cmk"
    Environment = var.environment
    Purpose     = "Backup-Encryption"
  }
}

resource "aws_kms_alias" "backup_key_alias" {
  name          = "alias/afyapoa-${var.environment}-backup"
  target_key_id = aws_kms_key.backup_encryption_key.key_id
}

# Outputs
output "db_key_arn" {
  value = aws_kms_key.db_encryption_key.arn
}

output "storage_key_arn" {
  value = aws_kms_key.storage_encryption_key.arn
}

output "backup_key_arn" {
  value = aws_kms_key.backup_encryption_key.arn
}
