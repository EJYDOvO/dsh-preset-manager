$ErrorActionPreference='Stop'
if(!$env:DSH_INSTALL_ROOT){throw 'Set DSH_INSTALL_ROOT explicitly'}
$project=Split-Path $PSScriptRoot -Parent
$node=Join-Path $env:DSH_INSTALL_ROOT 'resources/runtime/primary-runtime/dependencies/node/bin/node.exe'
& $node (Join-Path $PSScriptRoot 'stage-host.cjs') @args
if($LASTEXITCODE -ne 0){throw 'Staging failed'}
$run=Get-Content -LiteralPath (Join-Path $project '.local/host-run.json') -Raw | ConvertFrom-Json
$saved=@{};foreach($key in @('DSH_HOME','DSH_AGENTS_HOME','ELECTRON_RUN_AS_NODE','TEMP','TMP')){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process')}
$p=$null
try {
 $env:DSH_HOME=$run.home;$env:DSH_AGENTS_HOME=Join-Path $run.home 'agents';$env:ELECTRON_RUN_AS_NODE='1';$env:TEMP=Join-Path $run.home 'tmp';$env:TMP=$env:TEMP
 $exe=Join-Path $env:DSH_INSTALL_ROOT 'DeepSeek Harness.exe'
 $cli=Join-Path $env:DSH_INSTALL_ROOT 'resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-desktop-host/lib/cli.js'
 $resolver=([Uri](Join-Path $project 'test/sdk-resolver.mjs')).AbsoluteUri
 for($phase=0;$phase -lt 2;$phase++){
  if($phase -gt 0){Move-Item -LiteralPath $run.result -Destination (Join-Path $run.home 'phase0.json')}
  $p=Start-Process -FilePath $exe -ArgumentList @('--expose-internals','--import',$resolver,$cli,'--profile','manager','--no-open','--port','0') -WorkingDirectory $run.home -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $run.home "stdout-$phase.log") -RedirectStandardError (Join-Path $run.home "stderr-$phase.log")
  $deadline=(Get-Date).AddSeconds(60)
  while(!(Test-Path -LiteralPath $run.result) -and (Get-Date) -lt $deadline -and !$p.HasExited){Start-Sleep -Milliseconds 250;$p.Refresh()}
  if(!(Test-Path -LiteralPath $run.result)){throw 'Isolated Host timed out; inspect its local logs'}
  $report=Get-Content -LiteralPath $run.result -Raw | ConvertFrom-Json
  if($report.runId -ne $run.runId -or $report.phase -ne $phase -or !$report.ok){$report | ConvertTo-Json -Depth 6;throw 'Fresh native assertions failed'}
  $report | ConvertTo-Json -Depth 6
  if(($args -contains '--preview') -and $phase -eq 0){
   $deadline=(Get-Date).AddSeconds(600)
   while(!(Test-Path -LiteralPath (Join-Path $run.home 'preview.done')) -and (Get-Date) -lt $deadline -and !$p.HasExited){Start-Sleep -Milliseconds 250;$p.Refresh()}
  }
  $p.Refresh();if(!$p.HasExited){Stop-Process -Id $p.Id};if(!$p.WaitForExit(5000)){throw 'Isolated Host failed to stop'};$p=$null
  if($phase -eq 0){& $node (Join-Path $PSScriptRoot 'switch-test-profile.cjs');if($LASTEXITCODE -ne 0){throw 'Isolated Profile switch failed'}}
 }
} finally {
 try{if($p){$p.Refresh();if(!$p.HasExited){Stop-Process -Id $p.Id};$null=$p.WaitForExit(5000)}}finally{foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}}
}
