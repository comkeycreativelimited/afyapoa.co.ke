# infra/terraform/environments/prod/variables.tf

variable "aws_region" {
  type        = string
  default     = "af-south-1" # Or sovereign Kenyan cloud endpoint
  description = "Hosting region"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["ke-nairobi-1a", "ke-nairobi-1b"]
  description = "Sovereign availability zones in Nairobi"
}

variable "certificate_arn" {
  type        = string
  description = "ACM Certificate ARN for production domain (*.afyapoa.co.ke)"
}

variable "alert_email" {
  type        = string
  default     = "security-sre@afyapoa.co.ke"
  description = "Designated incident notification email for P1/P2 alerts"
}
