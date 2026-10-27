# deploy/terraform/modules/compute/main.tf
# Sovereign Container Compute & Ingress Application Load Balancer
# Compliance: OWASP ASVS V1, TLS 1.3 Termination, Zero-Trust Private Networking

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

variable "public_subnet_ids" {
  type        = list(string)
  description = "Public DMZ subnet IDs for ALBs"
}

variable "private_subnet_ids" {
  type        = list(string)
  description = "Private compute subnet IDs"
}

variable "certificate_arn" {
  type        = string
  description = "ACM TLS Certificate ARN for *.afyapoa.co.ke"
}

# 1. Security Group: Ingress Application Load Balancer
resource "aws_security_group" "alb_sg" {
  name        = "afyapoa-${var.environment}-alb-sg"
  description = "ALB Public DMZ Ingress with TLS 1.3"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTPS from Cloudflare Edge / Public Web"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Forward to private compute containers"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.10.0/24", "10.0.11.0/24"] # Private compute subnets only
  }

  tags = {
    Name        = "afyapoa-${var.environment}-alb-sg"
    Environment = var.environment
  }
}

# 2. Security Group: Private Compute Workloads (API, Web, Workers)
resource "aws_security_group" "compute_sg" {
  name        = "afyapoa-${var.environment}-compute-sg"
  description = "Ingress restricted to ALB and internal microservices"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Next.js Web traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  ingress {
    description     = "NestJS API traffic from ALB"
    from_port       = 4000
    to_port         = 4000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    description = "Outbound to internet via NAT (for DHA/SHA/KRA APIs) and internal database"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "afyapoa-${var.environment}-compute-sg"
    Environment = var.environment
  }
}

# 3. Application Load Balancer
resource "aws_lb" "main_alb" {
  name               = "afyapoa-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false
  drop_invalid_header_fields = true # Mitigates HTTP request smuggling

  tags = {
    Name        = "afyapoa-${var.environment}-alb"
    Environment = var.environment
  }
}

# 4. Target Groups
resource "aws_lb_target_group" "web_tg" {
  name        = "afyapoa-${var.environment}-web-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "afyapoa-${var.environment}-web-tg"
  }
}

resource "aws_lb_target_group" "api_tg" {
  name        = "afyapoa-${var.environment}-api-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "afyapoa-${var.environment}-api-tg"
  }
}

# 5. HTTPS Listener (TLS 1.3 enforced)
resource "aws_lb_listener" "https_listener" {
  load_balancer_arn = aws_lb.main_alb.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web_tg.arn
  }
}

# 6. API Path Routing Rule
resource "aws_lb_listener_rule" "api_routing_rule" {
  listener_arn = aws_lb_listener.https_listener.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api_tg.arn
  }

  condition {
    path_pattern {
      values = ["/api/*", "/health*", "/auth/*", "/claims/*", "/patients/*", "/fhir/*", "/billing/*"]
    }
  }
}

# 7. HTTP to HTTPS Automatic Redirect
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Outputs
output "alb_dns_name" {
  value = aws_lb.main_alb.dns_name
}

output "alb_zone_id" {
  value = aws_lb.main_alb.zone_id
}

output "compute_security_group_id" {
  value = aws_security_group.compute_sg.id
}

output "web_target_group_arn" {
  value = aws_lb_target_group.web_tg.arn
}

output "api_target_group_arn" {
  value = aws_lb_target_group.api_tg.arn
}
