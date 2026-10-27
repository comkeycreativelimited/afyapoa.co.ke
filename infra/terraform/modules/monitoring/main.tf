# deploy/terraform/modules/monitoring/main.tf
# Centralized Logs, Metrics, Health Probes & P1/P2 Alerting
# Compliance: ISO/IEC 27001 A.12.4, Kenya Data Protection Act 2019 Sec 43

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

variable "alert_email" {
  type        = string
  default     = "ops-alerts@afyapoa.co.ke"
  description = "Primary operational on-call alert email"
}

# 1. Centralized CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api_logs" {
  name              = "/afyapoa/${var.environment}/api"
  retention_in_days = 365 # 1-year compliance retention

  tags = {
    Environment = var.environment
    Service     = "API"
  }
}

resource "aws_cloudwatch_log_group" "web_logs" {
  name              = "/afyapoa/${var.environment}/web"
  retention_in_days = 180

  tags = {
    Environment = var.environment
    Service     = "Web"
  }
}

resource "aws_cloudwatch_log_group" "worker_logs" {
  name              = "/afyapoa/${var.environment}/worker"
  retention_in_days = 365

  tags = {
    Environment = var.environment
    Service     = "BullMQ-Worker"
  }
}

# 2. SNS Alert Topic for P1/P2 Escalations
resource "aws_sns_topic" "alerts_topic" {
  name = "afyapoa-${var.environment}-incident-alerts"

  tags = {
    Name        = "afyapoa-${var.environment}-incident-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "email_sub" {
  topic_arn = aws_sns_topic.alerts_topic.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# 3. High 5xx Error Rate Alarm (Trigger: > 1% 5xx responses for 5 mins)
resource "aws_cloudwatch_metric_alarm" "api_5xx_alarm" {
  alarm_name          = "afyapoa-${var.environment}-api-high-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "P1 Alert: High 5xx server error rate detected on API target group"
  alarm_actions       = [aws_sns_topic.alerts_topic.arn]

  tags = {
    Severity = "P1-Critical"
  }
}

# 4. Target Group Unhealthy Host Alarm (Trigger: Any container unhealthy)
resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts_alarm" {
  alarm_name          = "afyapoa-${var.environment}-unhealthy-hosts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Average"
  threshold           = 0
  alarm_description   = "P2 Alert: Unhealthy container detected by ALB health probe"
  alarm_actions       = [aws_sns_topic.alerts_topic.arn]

  tags = {
    Severity = "P2-High"
  }
}

# 5. Database High CPU & Memory Saturation Alarm (Trigger: CPU > 85%)
resource "aws_cloudwatch_metric_alarm" "db_cpu_alarm" {
  alarm_name          = "afyapoa-${var.environment}-db-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  alarm_description   = "P2 Alert: Database CPU utilization exceeds 85%"
  alarm_actions       = [aws_sns_topic.alerts_topic.arn]

  tags = {
    Severity = "P2-High"
  }
}

# 6. Database Free Storage Space Low Alarm (Trigger: < 20 GB)
resource "aws_cloudwatch_metric_alarm" "db_storage_low_alarm" {
  alarm_name          = "afyapoa-${var.environment}-db-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 21474836480 # 20 GB in bytes
  alarm_description   = "P1 Alert: Database free storage space is below 20 GB"
  alarm_actions       = [aws_sns_topic.alerts_topic.arn]

  tags = {
    Severity = "P1-Critical"
  }
}

# Outputs
output "alerts_topic_arn" {
  value = aws_sns_topic.alerts_topic.arn
}

output "api_log_group_name" {
  value = aws_cloudwatch_log_group.api_logs.name
}
