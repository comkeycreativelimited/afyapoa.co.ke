# infra/terraform/environments/staging/main.tf
# Staging / Pre-Production Rehearsal Environment for COMKEY AFYA POA
# Purpose: Mirrors production topology; integrates with DHA/SHA/KRA staging sandboxes

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "COMKEY-AFYA-POA"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "af-south-1"
}

variable "availability_zones" {
  type    = list(string)
  default = ["ke-nairobi-1a", "ke-nairobi-1b"]
}

variable "certificate_arn" {
  type    = string
  default = "arn:aws:acm:af-south-1:123456789012:certificate/staging-placeholder"
}

module "kms" {
  source      = "../../modules/kms"
  environment = "staging"
}

module "vpc" {
  source             = "../../modules/vpc"
  environment        = "staging"
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = var.availability_zones
}

module "compute" {
  source             = "../../modules/compute"
  environment        = "staging"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  certificate_arn    = var.certificate_arn
}

module "database" {
  source                    = "../../modules/database"
  environment               = "staging"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  kms_key_arn               = module.kms.db_key_arn
  instance_class            = "db.t4g.medium" # Staging scale
  allocated_storage         = 100
  database_name             = "afyapoa_staging_db"
  master_username           = "afyapoa_admin"
}

module "redis" {
  source                    = "../../modules/redis"
  environment               = "staging"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  node_type                 = "cache.t4g.medium"
}

module "object_storage" {
  source              = "../../modules/object_storage"
  environment         = "staging"
  kms_storage_key_arn = module.kms.storage_key_arn
  kms_backup_key_arn  = module.kms.backup_key_arn
}

module "monitoring" {
  source      = "../../modules/monitoring"
  environment = "staging"
  alert_email = "dev-alerts@afyapoa.co.ke"
}
