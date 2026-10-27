# deploy/terraform/modules/vpc/main.tf
# Sovereign Kenyan Virtual Private Cloud (VPC)
# Jurisdiction: Republic of Kenya (Tier III Sovereign Cloud - Nairobi Node)
# Compliance: Data Protection Act 2019 (Regulation 26), Digital Health Act 2023 (Section 22)

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
  description = "Deployment environment (prod, staging, uat)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "Primary VPC CIDR block"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["ke-nairobi-1a", "ke-nairobi-1b"]
  description = "Kenyan sovereign availability zones"
}

# 1. VPC Resource
resource "aws_vpc" "sovereign_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "afyapoa-${var.environment}-sovereign-vpc"
    Environment = var.environment
    Jurisdiction = "Kenya-Sovereign"
    ManagedBy   = "Terraform"
  }
}

# 2. Public DMZ Subnets (Ingress Load Balancers & Cloudflare Edge)
resource "aws_subnet" "public_dmz" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.sovereign_vpc.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1) # 10.0.1.0/24, 10.0.2.0/24
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false # Public IPs only assigned to ALBs

  tags = {
    Name        = "afyapoa-${var.environment}-public-dmz-${count.index + 1}"
    Tier        = "Public-DMZ"
    Environment = var.environment
  }
}

# 3. Private Compute Subnets (Next.js Web, NestJS API, BullMQ Workers)
resource "aws_subnet" "private_compute" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.sovereign_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10) # 10.0.10.0/24, 10.0.11.0/24
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "afyapoa-${var.environment}-private-compute-${count.index + 1}"
    Tier        = "Private-Compute"
    Environment = var.environment
  }
}

# 4. Isolated Database & Storage Subnets (Zero Direct Internet Egress)
resource "aws_subnet" "isolated_database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.sovereign_vpc.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 20) # 10.0.20.0/24, 10.0.21.0/24
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "afyapoa-${var.environment}-isolated-db-${count.index + 1}"
    Tier        = "Isolated-Database"
    Environment = var.environment
  }
}

# 5. Internet Gateway & NAT Gateways (for Compute egress to DHA/SHA/KRA APIs)
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.sovereign_vpc.id

  tags = {
    Name        = "afyapoa-${var.environment}-igw"
    Environment = var.environment
  }
}

resource "aws_eip" "nat_eip" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name        = "afyapoa-${var.environment}-nat-eip-${count.index + 1}"
    Environment = var.environment
  }
}

resource "aws_nat_gateway" "nat_gw" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat_eip[count.index].id
  subnet_id     = aws_subnet.public_dmz[count.index].id

  tags = {
    Name        = "afyapoa-${var.environment}-nat-gw-${count.index + 1}"
    Environment = var.environment
  }

  depends_on = [aws_internet_gateway.igw]
}

# 6. Route Tables
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.sovereign_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name        = "afyapoa-${var.environment}-public-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "public_assoc" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public_dmz[count.index].id
  route_table_id = aws_route_table.public_rt.id
}

resource "aws_route_table" "private_rt" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.sovereign_vpc.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat_gw[count.index].id
  }

  tags = {
    Name        = "afyapoa-${var.environment}-private-rt-${count.index + 1}"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "private_assoc" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.private_compute[count.index].id
  route_table_id = aws_route_table.private_rt[count.index].id
}

# Isolated subnets have NO 0.0.0.0/0 internet route
resource "aws_route_table" "isolated_rt" {
  vpc_id = aws_vpc.sovereign_vpc.id

  tags = {
    Name        = "afyapoa-${var.environment}-isolated-rt"
    Environment = var.environment
  }
}

resource "aws_route_table_association" "isolated_assoc" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.isolated_database[count.index].id
  route_table_id = aws_route_table.isolated_rt.id
}

# 7. VPC Flow Logs for Centralized Audit Compliance
resource "aws_flow_log" "vpc_flow_log" {
  iam_role_arn    = aws_iam_role.flow_log_role.arn
  log_destination = aws_cloudwatch_log_group.flow_log_group.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.sovereign_vpc.id

  tags = {
    Name        = "afyapoa-${var.environment}-vpc-flow-logs"
    Environment = var.environment
  }
}

resource "aws_cloudwatch_log_group" "flow_log_group" {
  name              = "/afyapoa/${var.environment}/vpc-flow-logs"
  retention_in_days = 365 # 1-year retention for network audit trail
}

resource "aws_iam_role" "flow_log_role" {
  name = "afyapoa-${var.environment}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "flow_log_policy" {
  name = "afyapoa-${var.environment}-flow-log-policy"
  role = aws_iam_role.flow_log_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

# 8. Outputs
output "vpc_id" {
  value = aws_vpc.sovereign_vpc.id
}

output "public_subnet_ids" {
  value = aws_subnet.public_dmz[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private_compute[*].id
}

output "isolated_subnet_ids" {
  value = aws_subnet.isolated_database[*].id
}
