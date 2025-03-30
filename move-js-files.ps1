# Script to move all JavaScript files to js_implementation directory while preserving directory structure
Write-Host "Moving JavaScript files to js_implementation directory..."

# Get all JavaScript files in the src directory
$jsFiles = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse

# Process each JavaScript file
foreach ($file in $jsFiles) {
    # Get the relative path of the file from src directory
    $relativePath = $file.FullName.Substring($file.FullName.IndexOf("src"))
    
    # Create the destination path
    $destinationPath = $relativePath.Replace("src", "ts\src")
    
    # Create the directory structure if it doesn't exist
    $destinationDir = Split-Path -Path $destinationPath -Parent
    if (!(Test-Path -Path $destinationDir)) {
        Write-Host "Creating directory: $destinationDir"
        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
    }
    
    # Move the file
    Write-Host "Moving $($file.FullName) to $destinationPath"
    Move-Item -Path $file.FullName -Destination $destinationPath -Force
}

Write-Host "Migration completed! All JavaScript files moved to js_implementation directory." 