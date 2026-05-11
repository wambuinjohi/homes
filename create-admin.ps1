# Create Super Admin User Script
# Configuration
$PROJECT_ID = "tbmzwmgsvshfdxdoyrcr"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXp3bWdzdnNoZmR4ZG95cmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNzYzMDgsImV4cCI6MjA5Mzg1MjMwOH0.EnT2YlYgtauy2noqJOYj_2sDWE8xpobx0Sz5TRtU7dc"
$BASE_URL = "https://$PROJECT_ID.supabase.co"

# Admin user details
$email = "gichukisimon@gmail.com"
$password = "Sirgeorge.12"
$firstName = "Simon"
$lastName = "Gichuki"

# Prepare headers
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer $ANON_KEY"
}

# Prepare body
$body = @{
    email = $email
    password = $password
    firstName = $firstName
    lastName = $lastName
    role = "Admin"
} | ConvertTo-Json

# Create the admin user
Write-Host "Creating super admin user: $email"
Write-Host "URL: $BASE_URL/functions/v1/create-admin-user"

try {
    $response = Invoke-WebRequest `
        -Uri "$BASE_URL/functions/v1/create-admin-user" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ContentType "application/json"
    
    $result = $response.Content | ConvertFrom-Json
    
    if ($result.success) {
        Write-Host "`n✅ Super Admin Created Successfully!" -ForegroundColor Green
        Write-Host "Email: $email" -ForegroundColor Green
        Write-Host "Password: $password" -ForegroundColor Green
        Write-Host "Name: $firstName $lastName" -ForegroundColor Green
        Write-Host "`nYou can now log in and create other users!" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Error: $($result.error)" -ForegroundColor Red
    }
} catch {
    Write-Host "`n❌ Request failed: $($_.Exception.Message)" -ForegroundColor Red
}
