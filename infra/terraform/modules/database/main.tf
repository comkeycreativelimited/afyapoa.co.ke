# deploy/terraform/modules/database/main.tf
# Sovereign PostgreSQL 16 High-Availability Cluster with Row-Level Security
# Compliance: ISO/IEC 27001, OWASP ASVS V2-V4, Kenya Data Protection Act 2019

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

variable "vpc_id" {
  type        = string
  description = "VPC ID"
}

variable "subnet_ids" {
  type        = list(string)
  description = "Isolated database subnet IDs"
}

variable "compute_security_group_id" {
  type        = string
  description = "Security Group ID of the compute pods"
}

variable "kms_key_arn" {
  type        = string
  description = "KMS CMK ARN for database encryption"
}

variable "instance_class" {
  type        = string
  default     = "db.r6g.xlarge" # 4 vCPU, 32 GB RAM for production
  description = "Database instance size"
}

variable "allocated_storage" {
  type        = number
  default     = 250
  description = "Allocated storage in GB (auto-scales up to 1000 GB)"
}

variable "database_name" {
  type        = string
  default     = "afyapoa_prod_db"
  description = "Database name"
}

variable "master_username" {
  type        = string
  default     = "afyapoa_admin"
  description = "Database master administrator username"
}

# 1. Security Group for PostgreSQL
resource "aws_security_group" "db_sg" {
  name        = "afyapoa-${var.environment}-db-sg"
  description = "PostgreSQL 16 isolated ingress from private compute subnets"
  vpc_id      = var.vpc_id

  ingress {
    description     = "PostgreSQL from API and worker compute pods only"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.compute_security_group_id]
  }

  egress {
    description = "No direct internet egress from database tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"] # Local VPC only
  }

  tags = {
    Name        = "afyapoa-${var.environment}-db-sg"
    Environment = var.environment
  }
}

# 2. Database Subnet Group
resource "aws_db_subnet_group" "db_subnet_group" {
  name       = "afyapoa-${var.environment}-db-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "afyapoa-${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

# 3. Custom Parameter Group for Audit Logging & Security Hardening
resource "aws_db_parameter_group" "pg16_params" {
  name   = "afyapoa-${var.environment}-pg16-params"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "password_encryption"
    value = "scram-sha-256"
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pgaudit,pg_stat_statements"
  }

  parameter {
    name  = "pgaudit.log"
    value = "write, ddl, role" # Full DDL and data modification audit
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "250" # Log slow queries exceeding 250ms
  }

  tags = {
    Name        = "afyapoa-${var.environment}-pg16-params"
    Environment = var.environment
  }
}

# 4. Master Password Random Generator
resource "random_password" "master_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# 5. Secrets Manager Secret for DB Credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "afyapoa/${var.environment}/database/credentials"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = 0 # Immediate deletion upon destruction

  tags = {
    Environment = var.environment
  }
}

resource "aws_secretsmanager_secret_version" "db_credentials_version" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.postgres_primary.address
    port     = 5432
    username = var.master_username
    password = random_password.master_password.result
    database = var.database_name
  })
}

# 6. Multi-AZ PostgreSQL 16 Cluster Instance
resource "aws_db_instance" "postgres_primary" {
  identifier                  = "afyapoa-${var.environment}-pg-primary"
  engine                      = "postgres"
  engine_version              = "16.3"
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = 1000
  storage_type                = "gp3"
  storage_encrypted           = true
  kms_key_id                  = var.kms_key_arn
  multi_az                    = true # Synchronous replica in secondary AZ
  publicly_accessible         = false
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master_password.result

  db_subnet_group_name   = aws_db_subnet_group.db_subnet_group.name
  vpc_security_group_ids = [aws_security_group.db_sg.id]
  parameter_group_name   = aws_db_parameter_group.pg16_params.name

  backup_retention_period   = 35 # 35 days PITR continuous backup
  backup_window             = "23:00-01:00" # EAT midnight window
  maintenance_window        = "Sun:01:30-Sun:03:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "prod" ? true : false
  skip_final_snapshot       = var.environment == "prod" ? false : true
  final_snapshot_identifier = "afyapoa-${var.environment}-pg-final-snapshot"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name        = "afyapoa-${var.environment}-postgres"
    Environment = var.environment
  }
}

# Outputs
output "endpoint" {
  value = aws_db_instance.postgres_primary.endpoint
}

output "address" {
  value = aws_db_instance.postgres_primary.address
}

output "security_group_id" {
  value = aws_security_group.db_sg.id
}

output "credentials_secret_arn" {
  value = aws_secretsmanager_secret.db_credentials.arn
}
