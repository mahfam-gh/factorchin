param(
  [Parameter(Mandatory=$true)][string]$Sdk,
  [Parameter(Mandatory=$true)][string]$Jdk,
  [string]$Apk=(Join-Path $PSScriptRoot 'build\sefareshyar-debug.apk'),
  [string]$Ecj,
  [switch]$Unsigned,
  [string]$Bundletool
)
$ErrorActionPreference='Stop'
$Sdk=(Resolve-Path $Sdk).Path
$Jdk=(Resolve-Path $Jdk).Path
$env:JAVA_HOME=$Jdk
$env:Path=(Join-Path $Jdk 'bin')+';'+$env:Path
$tools=Join-Path $Sdk 'build-tools\35.0.0'
$android=Join-Path $Sdk 'platforms\android-35\android.jar'
$build=Join-Path $PSScriptRoot 'build\standalone'
$source=Join-Path $PSScriptRoot 'app\src\main'
New-Item -ItemType Directory -Force $build,(Join-Path $build 'classes'),(Join-Path $build 'dex'),(Split-Path -Parent ([IO.Path]::GetFullPath($Apk))) | Out-Null
function Run-Tool([string]$Tool,[string[]]$Arguments){
  & $Tool @Arguments
  if($LASTEXITCODE -ne 0){throw "$Tool failed ($LASTEXITCODE)"}
}
$javac=Join-Path $Jdk 'bin\javac.exe'
$java=Join-Path $Jdk 'bin\java.exe'
$jar=Join-Path $Jdk 'bin\jar.exe'
$keytool=Join-Path $Jdk 'bin\keytool.exe'
$classes=Join-Path $build 'classes'
$dex=Join-Path $build 'dex'
$jarFile=Join-Path $build 'compiled.jar'
$unpackedApk=Join-Path $build 'unsigned.apk'
$aligned=Join-Path $build 'aligned.apk'
$resources=Join-Path $build 'resources.zip'
$manifest=Join-Path $build 'AndroidManifest.xml'
$manifestText=[IO.File]::ReadAllText((Join-Path $source 'AndroidManifest.xml'))
[IO.File]::WriteAllText($manifest,$manifestText.Replace('<manifest ','<manifest package="ir.sefareshyar" '),[Text.UTF8Encoding]::new($false))
$sources=@(Get-ChildItem (Join-Path $source 'java') -Recurse -Filter '*.java' | ForEach-Object FullName)
if($Ecj){
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $androidOnly=Join-Path $build 'android-api.jar'
  $inputJar=[IO.Compression.ZipFile]::OpenRead($android)
  try {
    $outputJar=[IO.Compression.ZipFile]::Open($androidOnly,[IO.Compression.ZipArchiveMode]::Update)
    try {
      if($outputJar.Entries.Count -eq 0){
        foreach($entry in $inputJar.Entries){
          if($entry.FullName -notmatch '^(android/|org/json/|org/xmlpull/|dalvik/).+\.class$'){continue}
          $dest=$outputJar.CreateEntry($entry.FullName).Open()
          $src=$entry.Open()
          try { $src.CopyTo($dest) } finally { $src.Dispose(); $dest.Dispose() }
        }
      }
    } finally { $outputJar.Dispose() }
  } finally { $inputJar.Dispose() }
  Run-Tool $java (@('-jar',(Resolve-Path $Ecj).Path,'-17','-proc:none','-encoding','UTF-8','-classpath',$androidOnly,'-d',$classes)+$sources)
}else{
  Run-Tool $javac (@('-encoding','UTF-8','--release','17','-classpath',$android,'-d',$classes)+$sources)
}
Run-Tool $jar @('cf',$jarFile,'-C',$classes,'.')
Run-Tool (Join-Path $tools 'd8.bat') @('--release','--lib',$android,'--min-api','26','--output',$dex,$jarFile)
Run-Tool (Join-Path $tools 'aapt2.exe') @('compile','--dir',(Join-Path $source 'res'),'-o',$resources)
$link=@('link','-I',$android,'--manifest',$manifest,'-A',(Join-Path $source 'assets'),'--version-code','14','--version-name','3.1.1','--min-sdk-version','26','--target-sdk-version','35')
if($Bundletool){
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $bundleJar=(Resolve-Path $Bundletool).Path
  $proto=Join-Path $build 'proto.apk'
  $base=Join-Path $build 'base.zip'
  Run-Tool (Join-Path $tools 'aapt2.exe') ($link+@('--proto-format','-o',$proto,$resources))
  if(Test-Path -LiteralPath $base){Remove-Item -LiteralPath $base}
  $inArchive=[IO.Compression.ZipFile]::OpenRead($proto)
  try{
    $baseArchive=[IO.Compression.ZipFile]::Open($base,[IO.Compression.ZipArchiveMode]::Create)
    try{
      foreach($entry in $inArchive.Entries){
        $name=$entry.FullName
        if($name -eq 'AndroidManifest.xml'){$name='manifest/AndroidManifest.xml'}
        elseif($name -notmatch '^(assets/|res/|resources\.pb$)'){continue}
        $dst=$baseArchive.CreateEntry($name).Open()
        $src=$entry.Open()
        try{$src.CopyTo($dst)}finally{$src.Dispose();$dst.Dispose()}
      }
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($baseArchive,(Join-Path $dex 'classes.dex'),'dex/classes.dex') | Out-Null
    }finally{$baseArchive.Dispose()}
  }finally{$inArchive.Dispose()}
  Run-Tool $java @('-jar',$bundleJar,'build-bundle',"--modules=$base","--output=$Apk",'--overwrite')
  Run-Tool $java @('-jar',$bundleJar,'validate',"--bundle=$Apk")
  Write-Output $Apk
  return
}
Run-Tool (Join-Path $tools 'aapt2.exe') ($link+@('-o',$unpackedApk,$resources))
Run-Tool $jar @('uf',$unpackedApk,'-C',$dex,'classes.dex')
Run-Tool (Join-Path $tools 'zipalign.exe') @('-f','4',$unpackedApk,$aligned)
if($Unsigned){
  Copy-Item -LiteralPath $aligned -Destination $Apk -Force
  Run-Tool (Join-Path $tools 'zipalign.exe') @('-c','4',$Apk)
  Write-Output $Apk
  return
}
$debugKey=Join-Path $build 'debug.keystore'
if(-not (Test-Path $debugKey)){
  Run-Tool $keytool @('-genkeypair','-keystore',$debugKey,'-alias','sefareshyar-debug','-storepass','android','-keypass','android','-keyalg','RSA','-keysize','2048','-validity','10000','-dname','CN=Sefareshyar Test Build')
}
Run-Tool (Join-Path $tools 'apksigner.bat') @('sign','--ks',$debugKey,'--ks-key-alias','sefareshyar-debug','--ks-pass','pass:android','--key-pass','pass:android','--v4-signing-enabled','false','--out',$Apk,$aligned)
Run-Tool (Join-Path $tools 'apksigner.bat') @('verify','--verbose',$Apk)
Write-Output $Apk
