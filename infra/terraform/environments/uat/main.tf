# infra/terraform/environments/uat/main.tf
# UAT (User Acceptance Testing) Environment for COMKEY AFYA POA
# Purpose: Validates client hospital workflows and automated test journeys against simulated mock drivers

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
  region = "af-south-1"

  default_tags {
    tags = {
      Project     = "COMKEY-AFYA-POA"
      Environment = "uat"
      ManagedBy   = "Terraform"
    }
  }
}

module "kms" {
  source      = "../../modules/kms"
  environment = "uat"
}

module "vpc" {
  source      = "../../modules/vpc"
  environment = "uat"
  vpc_cidr    = "10.2.0.0/16"
}

module "compute" {
  source             = "../../modules/compute"
  environment        = "uat"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  certificate_arn    = "arn:aws:acm:af-south-1:123456789012:certificate/uat-placeholder"
}

module "database" {
  source                    = "../../modules/database"
  environment               = "uat"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  kms_key_arn               = module.kms.db_key_arn
  instance_class            = "db.t4g.small"
  allocated_storage         = 50
  database_name             = "afyapoa_uat_db"
  master_username           = "afyapoa_admin"
}

module "redis" {
  source                    = "../../modules/redis"
  environment               = "uat"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  node_type                 = "cache.t4g.small"
}

module "object_storage" {
  source              = "../../modules/object_storage"
  environment         = "uat"
  kms_storage_key_arn = module.kms.storage_key_arn
  kms_backup_key_arn  = module.kms.backup_key_arn
}

module "monitoring" {
  source      = "../../modules/monitoring"
  environment = "uat"
  alert_email = "uat-alerts@afyapoa.co.ke"
}
