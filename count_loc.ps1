# Ensure cloc is installed
if (-not (Get-Command cloc -ErrorAction SilentlyContinue)) {
    Write-Output "Installing cloc..."
    winget install cloc
}

# Generate the LOC report
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"Lines of Code Report - $date" | Out-File cloc_report.txt
cloc . --exclude-dir=node_modules,dist,coverage,.devcontainer | Out-File -Append cloc_report.txt
"" | Out-File -Append cloc_report.txt
"Generated on: $date" | Out-File -Append cloc_report.txt

# Commit and push changes
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
git add cloc_report.txt
git commit -m "Manual update of cloc report [$date]" 2>$null
git push origin main

Write-Output "LOC report updated and pushed."
