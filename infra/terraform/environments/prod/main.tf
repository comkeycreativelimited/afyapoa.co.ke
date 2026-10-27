# infra/terraform/environments/prod/main.tf
# Sovereign Production Environment for COMKEY AFYA POA
# Location: Tier III Sovereign Kenyan Data Center (Africa Data Centres ADC Nairobi / Safaricom Cloud)
# Mandate: 100% Data Localization under DPA Reg 26, DHA 2023 Sec 22

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Production state locked in encrypted remote S3 backend with DynamoDB locking
  backend "s3" {
    bucket         = "afyapoa-prod-terraform-state"
    key            = "environments/prod/terraform.tfstate"
    region         = "af-south-1" # Or local Kenyan OpenStack/S3 endpoint
    encrypt        = true
    dynamodb_table = "afyapoa-prod-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project      = "COMKEY-AFYA-POA"
      Environment  = "production"
      Jurisdiction = "Kenya-Sovereign"
      Compliance   = "DHA-2023-DPA-2019"
      ManagedBy    = "Terraform"
    }
  }
}

# 1. Sovereign KMS Customer Managed Keys
module "kms" {
  source      = "../../modules/kms"
  environment = "prod"
}

# 2. Sovereign Virtual Private Cloud (VPC)
module "vpc" {
  source             = "../../modules/vpc"
  environment        = "prod"
  vpc_cidr           = "10.0.0.0/16"
  availability_zones = var.availability_zones
}

# 3. Ingress Application Load Balancer & Compute Security
module "compute" {
  source             = "../../modules/compute"
  environment        = "prod"
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  certificate_arn    = var.certificate_arn
}

# 4. Multi-AZ PostgreSQL 16 Cluster with RLS & Audit Hardening
module "database" {
  source                    = "../../modules/database"
  environment               = "prod"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  kms_key_arn               = module.kms.db_key_arn
  instance_class            = "db.r6g.xlarge" # 4 vCPU, 32 GB RAM
  allocated_storage         = 500             # Auto-scales to 2000 GB
  database_name             = "afyapoa_prod_db"
  master_username           = "afyapoa_admin"
}

# 5. Redis 7 High-Availability Cache & Queue Broker
module "redis" {
  source                    = "../../modules/redis"
  environment               = "prod"
  vpc_id                    = module.vpc.vpc_id
  subnet_ids                = module.vpc.isolated_subnet_ids
  compute_security_group_id = module.compute.compute_security_group_id
  node_type                 = "cache.m6g.large"
}

# 6. S3 Encrypted Medical Scans, Preauth Attachments & 10-Year WORM Storage
module "object_storage" {
  source              = "../../modules/object_storage"
  environment         = "prod"
  kms_storage_key_arn = module.kms.storage_key_arn
  kms_backup_key_arn  = module.kms.backup_key_arn
}

# 7. Centralized Logging, Observability & Incident Alerting
module "monitoring" {
  source      = "../../modules/monitoring"
  environment = "prod"
  alert_email = var.alert_email
}
