param(
  [Parameter(Mandatory = $true)]
  [string]$LiteralPath,

  [Parameter(Mandatory = $true)]
  [string]$DestinationPath
)

$ErrorActionPreference = 'Stop'

Expand-Archive -LiteralPath $LiteralPath -DestinationPath $DestinationPath -Force
