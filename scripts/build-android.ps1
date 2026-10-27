$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskRoot
node scripts/build-web.js
if ($LASTEXITCODE -ne 0) { throw 'Web asset build failed' }
$taskJava = if ($env:JAVA_HOME -and (Test-Path -LiteralPath "$env:JAVA_HOME\bin\javac.exe")) { $env:JAVA_HOME } else { 'C:\Program Files\Android\Android Studio\jbr' }
if (-not (Test-Path -LiteralPath "$taskJava\bin\javac.exe")) { throw 'Set JAVA_HOME to a JDK 17 or newer.' }
$env:JAVA_HOME = $taskJava
$taskSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path -LiteralPath $taskSdk)) { throw 'Set ANDROID_HOME to your Android SDK.' }
$env:ANDROID_HOME = $taskSdk
$taskGradle = Join-Path $taskRoot 'android\gradlew.bat'
if (-not (Test-Path -LiteralPath $taskGradle)) {
    $taskGradle = Get-ChildItem -LiteralPath "$env:USERPROFILE\.gradle\wrapper\dists\gradle-8.13-bin" -Filter gradle.bat -Recurse | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $taskGradle) { throw 'Gradle 8.13 is required. Install it or run this project in Android Studio.' }
& $taskGradle -p android assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
New-Item -ItemType Directory -Path (Join-Path $taskRoot 'apk') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $taskRoot 'android\app\build\outputs\apk\debug\app-debug.apk') -Destination (Join-Path $taskRoot 'apk\SmartFleet.apk')
Write-Output 'One app for every role is ready: apk\SmartFleet.apk. This is a debug-signed pilot build.'
