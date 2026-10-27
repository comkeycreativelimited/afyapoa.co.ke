# deploy/terraform/modules/redis/main.tf
# Redis 7 In-Memory Cache and BullMQ Queue Broker
# Compliance: OWASP ASVS Session Management, TLS In-Transit Encryption

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
  description = "Isolated database/cache subnet IDs"
}

variable "compute_security_group_id" {
  type        = string
  description = "Security Group ID of compute pods"
}

variable "node_type" {
  type        = string
  default     = "cache.m6g.large" # 2 vCPU, 6.38 GB RAM
  description = "ElastiCache node type"
}

# 1. Security Group for Redis
resource "aws_security_group" "redis_sg" {
  name        = "afyapoa-${var.environment}-redis-sg"
  description = "Redis isolated ingress from private compute subnets"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis port from API and worker compute pods"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [var.compute_security_group_id]
  }

  egress {
    description = "No internet egress"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
  }

  tags = {
    Name        = "afyapoa-${var.environment}-redis-sg"
    Environment = var.environment
  }
}

# 2. Redis Subnet Group
resource "aws_elasticache_subnet_group" "redis_subnet_group" {
  name       = "afyapoa-${var.environment}-redis-subnet-group"
  subnet_ids = var.subnet_ids

  tags = {
    Name        = "afyapoa-${var.environment}-redis-subnet-group"
    Environment = var.environment
  }
}

# 3. Redis Auth Token Random Generator
resource "random_password" "redis_auth_token" {
  length  = 48
  special = false
}

# 4. Redis Replication Group (Multi-AZ with TLS In-Transit & At-Rest Encryption)
resource "aws_elasticache_replication_group" "redis_cluster" {
  replication_group_id       = "afyapoa-${var.environment}-redis"
  description                = "Redis 7 Cluster for Session and Queue Processing"
  node_type                  = var.node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"
  subnet_group_name          = aws_elasticache_subnet_group.redis_subnet_group.name
  security_group_ids         = [aws_security_group.redis_sg.id]
  automatic_failover_enabled = true
  multi_az_enabled           = true
  num_cache_clusters         = 2

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  snapshot_retention_limit = 7
  snapshot_window          = "02:00-03:00"

  tags = {
    Name        = "afyapoa-${var.environment}-redis"
    Environment = var.environment
  }
}

# Outputs
output "primary_endpoint" {
  value = aws_elasticache_replication_group.redis_cluster.primary_endpoint_address
}

output "security_group_id" {
  value = aws_security_group.redis_sg.id
}

output "auth_token" {
  value     = random_password.redis_auth_token.result
  sensitive = true
}
