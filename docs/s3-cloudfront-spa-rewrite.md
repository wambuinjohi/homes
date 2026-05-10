# AWS S3 + CloudFront SPA Configuration

## Overview
This guide walks through configuring AWS S3 and CloudFront to properly handle SPA routing for deep links and page refreshes.

## S3 Static Website Hosting

### 1. Configure S3 Bucket for Static Website Hosting
```bash
# Set the bucket policy to allow public read access
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 2. Enable Static Website Hosting
- Go to S3 bucket → Properties → Static website hosting
- **Index document**: `index.html`
- **Error document**: `index.html` (This is key for SPA routing!)

## CloudFront Distribution Configuration

### 1. Create CloudFront Distribution
- **Origin**: Point to your S3 bucket website endpoint (not the bucket directly)
- **Origin Domain**: Use the S3 website endpoint (e.g., `bucket-name.s3-website-region.amazonaws.com`)

### 2. Configure Custom Error Pages for SPA Routing
This is the critical step for SPA deep linking support:

**Error Pages Configuration:**
- Go to CloudFront distribution → Error Pages tab
- Create custom error response:
  - **HTTP Error Code**: 403 (Forbidden)
  - **Error Caching Minimum TTL**: 0
  - **Customize Error Response**: Yes
  - **Response Page Path**: `/index.html`
  - **HTTP Response Code**: 200

- Create another custom error response:
  - **HTTP Error Code**: 404 (Not Found)  
  - **Error Caching Minimum TTL**: 0
  - **Customize Error Response**: Yes
  - **Response Page Path**: `/index.html`
  - **HTTP Response Code**: 200

### 3. Behavior Settings
**Default Behavior:**
- **Viewer Protocol Policy**: Redirect HTTP to HTTPS
- **Compress Objects Automatically**: Yes
- **Cache Policy**: Managed-CachingOptimized (or create custom policy)

**API Route Behavior (if you have API endpoints):**
- **Path Pattern**: `/api/*`
- **Origin**: Your API server (not S3)
- **Cache Policy**: Managed-CachingDisabled

### 4. Security Headers (Optional but Recommended)
Add Lambda@Edge or CloudFront Functions to inject security headers:

```javascript
function handler(event) {
    var response = event.response;
    var headers = response.headers;

    headers['x-frame-options'] = {value: 'DENY'};
    headers['x-content-type-options'] = {value: 'nosniff'};
    headers['x-xss-protection'] = {value: '1; mode=block'};
    headers['strict-transport-security'] = {value: 'max-age=31536000; includeSubdomains'};

    return response;
}
```

## Deploy Process

### Using AWS CLI
```bash
# Build your app
npm run build

# Sync to S3 (replace bucket-name)
aws s3 sync dist/ s3://your-bucket-name --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
```

### Using GitHub Actions
```yaml
name: Deploy to S3 + CloudFront
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build
        run: npm run build
        
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Deploy to S3
        run: aws s3 sync dist/ s3://${{ secrets.S3_BUCKET }} --delete
        
      - name: Invalidate CloudFront
        run: aws cloudfront create-invalidation --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
```

## Testing SPA Routing

After configuration, test these scenarios:
1. **Direct deep links**: Navigate directly to `https://yourdomain.com/dashboard`
2. **Page refresh**: Refresh the page on any route
3. **Back/forward buttons**: Navigate through routes and use browser navigation
4. **404 handling**: Visit a truly non-existent route should show your React 404 page

## Troubleshooting

### Common Issues:
1. **Still getting S3 404s**: Make sure you're using the S3 website endpoint as CloudFront origin, not the REST endpoint
2. **API routes returning index.html**: Create a separate CloudFront behavior for `/api/*` patterns
3. **Caching issues**: Set appropriate TTL values and use cache invalidation after deployments
4. **Mixed content warnings**: Ensure CloudFront is configured for HTTPS redirect

### Verification:
```bash
# Test deep link
curl -I https://yourdomain.com/dashboard
# Should return 200, not 404

# Test API exclusion (if applicable)
curl -I https://yourdomain.com/api/health
# Should NOT return index.html
```

## Cost Optimization

- Use CloudFront's regional edge caches
- Configure appropriate TTL values for static assets
- Use S3 Intelligent-Tiering for cost savings
- Monitor CloudWatch for usage patterns