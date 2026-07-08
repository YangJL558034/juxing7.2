param(
  [string]$Configuration = "debug"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$projectDir = Join-Path $root "android-native"
$buildDir = Join-Path $projectDir "build"
$distDir = Join-Path $root "dist"

$sdkRoot = $env:ANDROID_HOME
if (-not $sdkRoot -or -not (Test-Path $sdkRoot)) {
  $sdkRoot = $env:ANDROID_SDK_ROOT
}
if (-not $sdkRoot -or -not (Test-Path $sdkRoot)) {
  $sdkRoot = Join-Path $env:LOCALAPPDATA "Android\Sdk"
}
if (-not (Test-Path $sdkRoot)) {
  throw "Android SDK not found. Please set ANDROID_HOME or install Android SDK."
}

$platformDir = Get-ChildItem (Join-Path $sdkRoot "platforms") -Directory |
  Where-Object { $_.Name -match '^android-\d+$' -and (Test-Path (Join-Path $_.FullName "android.jar")) } |
  Sort-Object { [int]($_.Name -replace '^android-', '') } -Descending |
  Select-Object -First 1
if (-not $platformDir) {
  throw "No valid Android platform with android.jar was found under $sdkRoot."
}
$androidJar = Join-Path $platformDir.FullName "android.jar"
$targetSdk = [int]($platformDir.Name -replace '^android-', '')

$buildToolsDir = Get-ChildItem (Join-Path $sdkRoot "build-tools") -Directory |
  Where-Object { Test-Path (Join-Path $_.FullName "aapt.exe") } |
  Sort-Object { [version]$_.Name } -Descending |
  Select-Object -First 1
if (-not $buildToolsDir) {
  throw "No Android build-tools were found under $sdkRoot."
}

$aapt = Join-Path $buildToolsDir.FullName "aapt.exe"
$d8 = Join-Path $buildToolsDir.FullName "d8.bat"
$zipalign = Join-Path $buildToolsDir.FullName "zipalign.exe"
$apksigner = Join-Path $buildToolsDir.FullName "apksigner.bat"
$javac = (Get-Command javac.exe -ErrorAction Stop).Source
$keytool = (Get-Command keytool.exe -ErrorAction Stop).Source

$resolvedBuildDir = [System.IO.Path]::GetFullPath($buildDir)
$resolvedProjectDir = [System.IO.Path]::GetFullPath($projectDir)
if (-not $resolvedBuildDir.StartsWith($resolvedProjectDir, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to clean unexpected build path: $resolvedBuildDir"
}

if (Test-Path $buildDir) {
  Remove-Item -LiteralPath $buildDir -Recurse -Force
}
New-Item -ItemType Directory -Force $buildDir, $distDir | Out-Null

$genDir = Join-Path $buildDir "gen"
$classesDir = Join-Path $buildDir "classes"
$dexDir = Join-Path $buildDir "dex"
New-Item -ItemType Directory -Force $genDir, $classesDir, $dexDir | Out-Null

$manifest = Join-Path $projectDir "AndroidManifest.xml"
$resDir = Join-Path $projectDir "res"
$assetsDir = Join-Path $projectDir "assets"
$resApk = Join-Path $buildDir "resources.apk"
$unsignedApk = Join-Path $buildDir "unsigned.apk"
$alignedApk = Join-Path $buildDir "aligned.apk"
$finalApk = Join-Path $distDir "juxing-$Configuration.apk"

& $aapt package `
  -f `
  -m `
  -J $genDir `
  -M $manifest `
  -S $resDir `
  -A $assetsDir `
  -I $androidJar `
  -F $resApk `
  --min-sdk-version 23 `
  --target-sdk-version $targetSdk
if ($LASTEXITCODE -ne 0) {
  throw "aapt failed with exit code $LASTEXITCODE"
}

$javaFiles = @()
$javaFiles += Get-ChildItem (Join-Path $projectDir "src") -Recurse -Filter *.java | ForEach-Object { $_.FullName }
$javaFiles += Get-ChildItem $genDir -Recurse -Filter *.java | ForEach-Object { $_.FullName }

& $javac `
  -encoding UTF-8 `
  -source 8 `
  -target 8 `
  -bootclasspath $androidJar `
  -classpath $androidJar `
  -d $classesDir `
  $javaFiles
if ($LASTEXITCODE -ne 0) {
  throw "javac failed with exit code $LASTEXITCODE"
}

$classFiles = Get-ChildItem $classesDir -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& $d8 `
  --lib $androidJar `
  --min-api 23 `
  --output $dexDir `
  $classFiles
if ($LASTEXITCODE -ne 0) {
  throw "d8 failed with exit code $LASTEXITCODE"
}

Copy-Item -LiteralPath $resApk -Destination $unsignedApk -Force
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::Open($unsignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
try {
  $existing = $zip.GetEntry("classes.dex")
  if ($existing) {
    $existing.Delete()
  }
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $dexDir "classes.dex"), "classes.dex") | Out-Null
} finally {
  $zip.Dispose()
}

& $zipalign -f 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "zipalign failed with exit code $LASTEXITCODE"
}

$keystore = Join-Path $projectDir "juxing-debug.keystore"
if (-not (Test-Path $keystore)) {
  & $keytool `
    -genkeypair `
    -v `
    -keystore $keystore `
    -storepass android `
    -keypass android `
    -alias juxing `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -dname "CN=Juxing,O=Juxing,C=CN"
  if ($LASTEXITCODE -ne 0) {
    throw "keytool failed with exit code $LASTEXITCODE"
  }
}

& $apksigner sign `
  --ks $keystore `
  --ks-pass pass:android `
  --key-pass pass:android `
  --out $finalApk `
  $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner sign failed with exit code $LASTEXITCODE"
}

& $apksigner verify --verbose $finalApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner verify failed with exit code $LASTEXITCODE"
}

Write-Host "APK built: $finalApk"
