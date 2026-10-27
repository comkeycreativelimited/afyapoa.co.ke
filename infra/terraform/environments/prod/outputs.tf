# infra/terraform/environments/prod/outputs.tf

output "vpc_id" {
  description = "Production Sovereign VPC ID"
  value       = module.vpc.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer entry point (pointed to by Cloudflare CNAME)"
  value       = module.compute.alb_dns_name
}

output "database_endpoint" {
  description = "Primary PostgreSQL Cluster private endpoint"
  value       = module.database.endpoint
}

output "redis_primary_endpoint" {
  description = "Primary Redis Cluster endpoint"
  value       = module.redis.primary_endpoint
}

output "medical_scans_bucket" {
  description = "S3 bucket for encrypted medical scans and attachments"
  value       = module.object_storage.medical_scans_bucket_name
}

output "backup_bucket" {
  description = "S3 bucket for encrypted database backups and WAL files"
  value       = module.object_storage.backup_bucket_name
}

output "monitoring_alerts_topic" {
  description = "SNS topic for operational incident alerts"
  value       = module.monitoring.alerts_topic_arn
}
