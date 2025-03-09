# Ensure cloc is installed
if (-not (Get-Command cloc -ErrorAction SilentlyContinue)) {
    Write-Output "Installing cloc..."
    winget install cloc
}

# Ensure GitHub CLI is installed
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Output "Installing GitHub CLI..."
    winget install GitHub.cli
}

# Set variables
$date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$branchName = "update-cloc-report-" + (Get-Date -Format "yyyyMMdd-HHmmss")

# Generate the LOC report
"Lines of Code Report - $date" | Out-File cloc_report.txt
cloc . --exclude-dir=node_modules,dist,coverage,.devcontainer | Out-File -Append cloc_report.txt
"" | Out-File -Append cloc_report.txt
"Generated on: $date" | Out-File -Append cloc_report.txt

# Commit and push changes to a new branch
git config --global user.name "CLOC BOT"
git config --global user.email "CLOC_BOT@gmail.com"

git checkout -b $branchName
git add cloc_report.txt
git commit -m "Update CLOC report [$date]" 2>$null
git push origin $branchName

# Create a pull request using GitHub CLI
gh pr create --base main --head $branchName --title "Update CLOC report [$date]" --body "This PR updates the Lines of Code (CLOC) report."

Write-Output "Pull request created successfully!"
